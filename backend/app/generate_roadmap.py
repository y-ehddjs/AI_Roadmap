from __future__ import annotations

import os
from datetime import date

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from .generate_roadmap_parse import parse_roadmap_response

GEMINI_MODEL = "gemini-2.5-flash"

router = APIRouter()


class GenerateRoadmapRequest(BaseModel):
    user_id: str
    title: str
    description: str | None = None


class GenerateRoadmapResponse(BaseModel):
    roadmap_id: str


@router.post("/generate-roadmap", response_model=GenerateRoadmapResponse)
async def generate_roadmap(payload: GenerateRoadmapRequest) -> GenerateRoadmapResponse:
    gemini_api_key = os.environ["GEMINI_API_KEY"]
    supabase_url = os.environ["SUPABASE_URL"]
    supabase_service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    today = date.today().isoformat()
    prompt = (
        f'오늘 날짜: {today}\n'
        f'사용자의 목표: "{payload.title}"\n'
        f'추가 설명: "{payload.description or ""}"\n'
        "이 목표를 달성하기 위한 마일스톤을 5~8개, 각 마일스톤의 title과 "
        "due_date(YYYY-MM-DD, 위 오늘 날짜를 기준으로 합리적인 간격을 두고 이후 날짜로)로 "
        "구성된 JSON 배열로만 응답해. 다른 설명 텍스트는 포함하지 마."
    )

    async with httpx.AsyncClient() as client:
        ai_response = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": gemini_api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": 1024},
            },
        )

    if ai_response.status_code != 200:
        raise HTTPException(status_code=502, detail="AI request failed")

    ai_json = ai_response.json()
    raw_text = (
        ai_json.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    )

    try:
        milestones = parse_roadmap_response(raw_text)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    supabase = create_client(supabase_url, supabase_service_role_key)

    roadmap = (
        supabase.table("roadmaps")
        .insert(
            {
                "user_id": payload.user_id,
                "title": payload.title,
                "description": payload.description,
                "source": "ai",
                "status": "active",
            }
        )
        .execute()
    ).data[0]

    try:
        supabase.table("milestones").insert(
            [
                {
                    "roadmap_id": roadmap["id"],
                    "title": m.title,
                    "due_date": m.due_date,
                    "order_index": m.order_index,
                    "status": "pending",
                }
                for m in milestones
            ]
        ).execute()
    except Exception as exc:
        # 마일스톤 insert가 실패하면 방금 만든 로드맵만 덩그러니 남는다(마일스톤 0개짜리
        # 고아 로드맵) - 실패를 알리기 전에 롤백 삼아 지운다.
        supabase.table("roadmaps").delete().eq("id", roadmap["id"]).execute()
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return GenerateRoadmapResponse(roadmap_id=roadmap["id"])
