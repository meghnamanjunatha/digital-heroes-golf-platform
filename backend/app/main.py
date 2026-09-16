from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.database import supabase

app = FastAPI()


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
