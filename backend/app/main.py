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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
