from datetime import date
from secrets import SystemRandom

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from app.database import supabase, service_supabase

app = FastAPI()
security = HTTPBearer()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    token = credentials.credentials
    try:
        auth_response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token") from None

    if not auth_response.user:
        raise HTTPException(status_code=401, detail="Invalid access token")

    return auth_response.user.id


class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str


@app.post("/signup")
def signup(data: SignupRequest):
    auth_response = supabase.auth.sign_up({
        "email": data.email,
        "password": data.password,
    })
    user = auth_response.user

    supabase.table("profiles").insert({
        "id": user.id,
        "full_name": data.full_name,
        "role": "user",
    }).execute()

    return {
        "message": "User created",
        "user_id": user.id,
    }


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(data: LoginRequest):
    auth_response = supabase.auth.sign_in_with_password({
        "email": data.email,
        "password": data.password,
    })

    return {
        "access_token": auth_response.session.access_token,
        "user_id": auth_response.user.id,
    }


class SubscriptionRequest(BaseModel):
    plan: str


@app.post("/subscriptions")
def create_subscription(
    data: SubscriptionRequest, user_id: str = Depends(get_current_user_id)
):
    if data.plan not in ("monthly", "yearly"):
        return {"error": "Invalid plan"}

    amount = 10 if data.plan == "monthly" else 100

    response = service_supabase.table("subscriptions").insert({
        "user_id": user_id,
        "plan": data.plan,
        "status": "active",
        "amount": amount,
    }).execute()

    return response.data


class CharitySelectionRequest(BaseModel):
    charity_id: int
    charity_percentage: float


@app.post("/charity-selection")
def select_charity(
    data: CharitySelectionRequest, user_id: str = Depends(get_current_user_id)
):
    if data.charity_percentage < 10:
        return {"error": "Charity percentage must be at least 10"}

    response = service_supabase.table("profiles").update({
        "selected_charity_id": data.charity_id,
        "charity_percentage": data.charity_percentage,
    }).eq("id", user_id).execute()

    return response.data


class ScoreRequest(BaseModel):
    score: int
    score_date: date


@app.post("/scores")
def create_score(data: ScoreRequest, user_id: str = Depends(get_current_user_id)):
    if not 1 <= data.score <= 45:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 45")

    score_date = data.score_date.isoformat()
    duplicate = (
        service_supabase.table("scores").select("id")
        .eq("user_id", user_id).eq("score_date", score_date)
        .limit(1).execute()
    )
    if duplicate.data:
        raise HTTPException(status_code=400, detail="Score date already exists")

    service_supabase.table("scores").insert({
        "user_id": user_id,
        "score": data.score,
        "score_date": score_date,
    }).execute()

    scores = (
        service_supabase.table("scores").select("*")
        .eq("user_id", user_id).order("score_date", desc=True).execute()
    ).data

    for old_score in scores[5:]:
        (
            service_supabase.table("scores").delete()
            .eq("id", old_score["id"]).eq("user_id", user_id).execute()
        )

    return scores[:5]


@app.get("/scores")
def get_scores(user_id: str = Depends(get_current_user_id)):
    response = (
        service_supabase.table("scores").select("*")
        .eq("user_id", user_id).order("score_date", desc=True).execute()
    )
    return response.data


@app.put("/scores/{score_id}")
def update_score(
    score_id: str, data: ScoreRequest,
    user_id: str = Depends(get_current_user_id),
):
    existing = (
        service_supabase.table("scores").select("id")
        .eq("id", score_id).eq("user_id", user_id).limit(1).execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Score not found")
    if not 1 <= data.score <= 45:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 45")

    score_date = data.score_date.isoformat()
    duplicate = (
        service_supabase.table("scores").select("id")
        .eq("user_id", user_id).eq("score_date", score_date)
        .neq("id", score_id).limit(1).execute()
    )
    if duplicate.data:
        raise HTTPException(status_code=400, detail="Score date already exists")

    response = (
        service_supabase.table("scores")
        .update({"score": data.score, "score_date": score_date})
        .eq("id", score_id).eq("user_id", user_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Score not found")
    return response.data[0]


@app.delete("/scores/{score_id}")
def delete_score(score_id: str, user_id: str = Depends(get_current_user_id)):
    response = (
        service_supabase.table("scores").delete()
        .eq("id", score_id).eq("user_id", user_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Score not found")
    return {"message": "Score deleted"}


@app.post("/draws/run")
def run_draw(user_id: str = Depends(get_current_user_id)):
    prize_pool = 1000
    numbers = SystemRandom().sample(range(1, 46), 5)

    draw = service_supabase.table("draws").insert({
        "numbers": numbers,
        "prize_pool": prize_pool,
        "published": True,
    }).execute().data[0]
    draw_id = draw["id"]

    scores_by_user = {}
    offset = 0
    page_size = 1000
    while True:
        page = (
            service_supabase.table("scores").select("id,user_id,score")
            .order("id").range(offset, offset + page_size - 1).execute()
        ).data
        for row in page:
            scores_by_user.setdefault(row["user_id"], set()).add(row["score"])
        if len(page) < page_size:
            break
        offset += page_size

    drawn_numbers = set(numbers)
    winners_by_tier = {3: [], 4: [], 5: []}
    for score_user_id, scores in scores_by_user.items():
        match_count = len(scores & drawn_numbers)
        if match_count in winners_by_tier:
            winners_by_tier[match_count].append(score_user_id)

    winner_rows = []
    for match_count, fraction in ((5, 0.40), (4, 0.35), (3, 0.25)):
        tier_winners = winners_by_tier[match_count]
        for score_user_id in tier_winners:
            winner_rows.append({
                "draw_id": draw_id,
                "user_id": score_user_id,
                "match_count": match_count,
                "prize_amount": prize_pool * fraction / len(tier_winners),
                "verification_status": "pending",
                "payment_status": "pending",
            })

    winners = (
        service_supabase.table("winners").insert(winner_rows).execute().data
        if winner_rows else []
    )
    return {
        "draw_id": draw_id,
        "numbers": numbers,
        "prize_pool": prize_pool,
        "winners": winners,
    }


@app.get("/winners")
def get_winners(user_id: str = Depends(get_current_user_id)):
    response = (
        service_supabase.table("winners").select("*")
        .eq("user_id", user_id).order("id", desc=True).execute()
    )
    return response.data


class WinnerProofRequest(BaseModel):
    proof_url: str


@app.post("/winners/{winner_id}/proof")
def submit_winner_proof(
    winner_id: str,
    data: WinnerProofRequest,
    user_id: str = Depends(get_current_user_id),
):
    response = (
        service_supabase.table("winners")
        .update({
            "proof_url": data.proof_url,
            "verification_status": "pending",
        })
        .eq("id", winner_id).eq("user_id", user_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Winner not found")
    return response.data[0]


class WinnerVerificationRequest(BaseModel):
    status: str


@app.put("/winners/{winner_id}/verify")
def verify_winner(
    winner_id: str,
    data: WinnerVerificationRequest,
    user_id: str = Depends(get_current_user_id),
):
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid verification status")

    response = (
        service_supabase.table("winners")
        .update({"verification_status": data.status})
        .eq("id", winner_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Winner not found")
    return response.data[0]


@app.put("/winners/{winner_id}/paid")
def mark_winner_paid(
    winner_id: str,
    user_id: str = Depends(get_current_user_id),
):
    response = (
        service_supabase.table("winners")
        .update({"payment_status": "paid"})
        .eq("id", winner_id).execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Winner not found")
    return response.data[0]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://digital-heroes-golf-platform-nine.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/charities")
def get_charities():
    response = supabase.table("charities").select("*").execute()
    return response.data
