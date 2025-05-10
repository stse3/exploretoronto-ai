from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
import torch
import json
from pathlib import Path
import logging
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WanderTO NLP Service")

# Load categories from JSON file
CATEGORIES_FILE = Path(__file__).parent / "toronto_categories.json"
with open(CATEGORIES_FILE) as f:
    EVENT_CATEGORIES = json.load(f)["categories"]

# Load model (will download on first run)
try:
    classifier = pipeline(
        "zero-shot-classification",
        model="facebook/bart-large-mnli",
        device=0 if torch.cuda.is_available() else -1
    )
    logger.info("NLP model loaded successfully")
except Exception as e:
    logger.error(f"Failed to load model: {str(e)}")
    raise

class ClassificationRequest(BaseModel):
    text: str
    threshold: float = 0.15

@app.post("/classify")
async def classify_text(request: ClassificationRequest):
    """Classify user input into Toronto event categories"""
    try:
        result = classifier(
            request.text,
            EVENT_CATEGORIES,
            multi_label=True
        )
        
        # Filter results above threshold
        categories = [
            {"label": label, "score": float(score)}
            for label, score in zip(result["labels"], result["scores"])
            if score >= request.threshold
        ]
        
        # Sort by score (highest first)
        categories.sort(key=lambda x: x["score"], reverse=True)
        
        return {"categories": categories}
    
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/categories")
async def get_categories():
    """Return all available event categories"""
    return {"categories": EVENT_CATEGORIES}

# At the bottom of main.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
