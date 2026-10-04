import os
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

import laya

# Load Laya model globally
agent = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent
    if agent is None:
        print("Loading Laya decision model (convaiinnovations/laya)...")
        agent = laya.load("convaiinnovations/laya")
        print("Laya model loaded successfully!")
    yield

app = FastAPI(
    title="Laya Decision Service",
    description="Local Laya Decision & Virality Engine for Bot Content",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StoryEvalRequest(BaseModel):
    headline: str
    description: Optional[str] = ""
    body: Optional[str] = ""

class PostCandidate(BaseModel):
    title: str
    caption: str
    tags: List[str]

class CandidateEvalRequest(BaseModel):
    story_summary: str
    candidates: List[PostCandidate]

class RawPredictRequest(BaseModel):
    state: Dict[str, Any]
    questions: Dict[str, Any]

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": "convaiinnovations/laya",
        "ready": agent is not None
    }

@app.post("/predict")
def predict_raw(req: RawPredictRequest):
    global agent
    if agent is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    try:
        res = agent.predict(req.state, req.questions)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate-story")
def evaluate_story(req: StoryEvalRequest):
    global agent
    if agent is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    text_content = f"{req.headline}\n{req.description or ''}\n{(req.body or '')[:1000]}".strip()
    
    questions = {
        "virality_score": {
            "type": "score",
            "instructions": "How viral and trending is this tech story in `post`?",
            "criteria": [
                "routine update / minor bugfix / niche library",
                "moderate tech interest / notable product update",
                "trending breakthrough / major industry news",
                "massive viral tech phenomenon / industry-shaking event"
            ]
        },
        "curiosity_gap": {
            "type": "score",
            "instructions": "How much curiosity and intrigue does this story in `post` create for readers?",
            "criteria": [
                "predictable and low curiosity",
                "moderately intriguing",
                "high curiosity gap that demands reading"
            ]
        },
        "content_category": {
            "type": "choice",
            "instructions": "What primary category best describes `post`?",
            "criteria": {
                "ai_breakthrough": "major AI model release, AGI, LLM advancements, machine learning",
                "developer_tools": "programming languages, frameworks, developer productivity, code tools",
                "industry_drama": "tech controversies, executive changes, antitrust, layoffs, major tech shifts",
                "cybersecurity": "critical zero-day vulnerabilities, breaches, security research",
                "hardware_science": "chips, quantum computing, robotics, hardware innovation",
                "general_tech": "general web, startups, and consumer technology"
            }
        }
    }
    
    try:
        pred = agent.predict({"post": text_content}, questions)
        answers = pred.get("answers", {})
        
        virality_raw = answers.get("virality_score", {})
        curiosity_raw = answers.get("curiosity_gap", {})
        category_raw = answers.get("content_category", {})
        
        # Normalize score (virality 0-3 -> 0-1, curiosity 0-2 -> 0-1)
        v_score = virality_raw.get("score", 0.0) / 3.0
        c_score = curiosity_raw.get("score", 0.0) / 2.0
        
        composite_virality = round((v_score * 0.6) + (c_score * 0.4), 3)
        
        return {
            "composite_virality_score": composite_virality,
            "category": category_raw.get("choice", "general_tech"),
            "category_confidence": round(category_raw.get("confidence", 0.5), 3),
            "virality_score": round(v_score, 3),
            "curiosity_score": round(c_score, 3),
            "details": answers
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Laya story evaluation failed: {str(e)}")

@app.post("/evaluate-candidates")
def evaluate_candidates(req: CandidateEvalRequest):
    global agent
    if agent is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    if not req.candidates:
        raise HTTPException(status_code=400, detail="Candidates list cannot be empty")
    
    evaluated_candidates = []
    
    for idx, candidate in enumerate(req.candidates):
        post_text = f"Title: {candidate.title}\nTweet: {candidate.caption}\nTags: {' '.join(candidate.tags)}"
        state = {
            "story": req.story_summary[:800],
            "post": post_text
        }
        
        questions = {
            "hook_strength": {
                "type": "score",
                "instructions": "How strong and scroll-stopping is the hook in `post` for Twitter/X?",
                "criteria": [
                    "weak / boring / generic headline",
                    "decent and readable but standard",
                    "compelling and engaging hook",
                    "irresistible scroll-stopper with immediate curiosity"
                ]
            },
            "click_through_appeal": {
                "type": "score",
                "instructions": "How likely is a reader on Twitter/X to click and share `post` about `story`?",
                "criteria": [
                    "low likelihood to click or share",
                    "moderate interest to click",
                    "very high click-through and viral share appeal"
                ]
            }
        }
        
        try:
            pred = agent.predict(state, questions)
            answers = pred.get("answers", {})
            
            hook_score = answers.get("hook_strength", {}).get("score", 0.0) / 3.0
            ctr_score = answers.get("click_through_appeal", {}).get("score", 0.0) / 2.0
            
            # Composite quality score 0.0 to 1.0
            quality_score = round((hook_score * 0.6) + (ctr_score * 0.4), 3)
            
            evaluated_candidates.append({
                "index": idx,
                "candidate": candidate.dict(),
                "quality_score": quality_score,
                "hook_score": round(hook_score, 3),
                "ctr_score": round(ctr_score, 3),
                "confidence": round(answers.get("hook_strength", {}).get("confidence", 0.5), 3)
            })
        except Exception as e:
            # Fallback score if single candidate evaluation errors
            evaluated_candidates.append({
                "index": idx,
                "candidate": candidate.dict(),
                "quality_score": 0.5,
                "hook_score": 0.5,
                "ctr_score": 0.5,
                "error": str(e)
            })
            
    # Sort candidates by quality score descending
    evaluated_candidates.sort(key=lambda c: c["quality_score"], reverse=True)
    best_candidate = evaluated_candidates[0]
    
    return {
        "best_index": best_candidate["index"],
        "best_candidate": best_candidate["candidate"],
        "best_score": best_candidate["quality_score"],
        "ranked_candidates": evaluated_candidates
    }

if __name__ == "__main__":
    port = int(os.environ.get("LAYA_PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
