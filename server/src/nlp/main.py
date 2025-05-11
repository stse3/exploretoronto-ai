from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from transformers import pipeline
import torch
import json
from pathlib import Path
import logging
import os
from typing import List, Dict, Any, Optional
from functools import lru_cache
import asyncio
from concurrent.futures import ThreadPoolExecutor
import time

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure the model
MAX_BATCH_SIZE = int(os.environ.get("MAX_BATCH_SIZE", 20))
MAX_WORKERS = min(int(os.environ.get("MAX_WORKERS", 2)), os.cpu_count() or 1)
MODEL_NAME = os.environ.get("MODEL_NAME", "facebook/bart-large-mnli")
DEVICE = 0 if torch.cuda.is_available() else -1
EXECUTOR = ThreadPoolExecutor(max_workers=MAX_WORKERS)

# Create the FastAPI app
app = FastAPI(title="WanderTO NLP Service")

# Load categories from JSON file
CATEGORIES_FILE = Path(__file__).parent / "toronto_categories.json"
with open(CATEGORIES_FILE) as f:
    EVENT_CATEGORIES = json.load(f)["categories"]

# Create a persistent classifier to avoid reloading
@lru_cache(maxsize=1)
def get_classifier():
    try:
        logger.info(f"Loading model {MODEL_NAME} on device {DEVICE} with {MAX_WORKERS} workers")
        model = pipeline(
            "zero-shot-classification",
            model=MODEL_NAME,
            device=DEVICE
        )
        logger.info("NLP model loaded successfully")
        return model
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        raise

# Initialize the model at startup
classifier = get_classifier()

class ClassificationRequest(BaseModel):
    text: str
    threshold: float = 0.15

class BatchClassificationItem(BaseModel):
    id: str
    text: str
    threshold: Optional[float] = 0.15

class BatchClassificationRequest(BaseModel):
    events: List[BatchClassificationItem]
    threshold: Optional[float] = 0.15  # Default threshold for all items

def classify_text_sync(text: str, threshold: float = 0.15):
    """Synchronous classification function for a single text"""
    try:
        # Get the classifier
        model = get_classifier()
        
        # Process the text
        result = model(
            text,
            EVENT_CATEGORIES,
            multi_label=True
        )
        
        # Filter results above threshold
        categories = [
            {"label": label, "score": float(score)}
            for label, score in zip(result["labels"], result["scores"])
            if score >= threshold
        ]
        
        # Sort by score (highest first)
        categories.sort(key=lambda x: x["score"], reverse=True)
        
        return categories
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        return []

async def classify_text_async(text: str, threshold: float = 0.15):
    """Asynchronous classification function that runs in a thread pool"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(EXECUTOR, classify_text_sync, text, threshold)

@app.post("/classify")
async def classify_text(request: ClassificationRequest):
    """Classify user input into Toronto event categories"""
    try:
        # Process asynchronously
        categories = await classify_text_async(request.text, request.threshold)
        return {"categories": categories}
    
    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch")
async def batch_classify(request: BatchClassificationRequest):
    """Batch classify multiple texts into Toronto event categories"""
    try:
        default_threshold = request.threshold
        start_time = time.time()
        logger.info(f"Starting batch classification of {len(request.events)} items")
        
        # Process the batch of events in parallel
        async def process_item(item: BatchClassificationItem):
            try:
                threshold = item.threshold if item.threshold is not None else default_threshold
                categories = await classify_text_async(item.text, threshold)
                return {"id": item.id, "categories": categories}
            except Exception as e:
                logger.error(f"Error processing item {item.id}: {str(e)}")
                return {"id": item.id, "categories": []}
        
        # Process in smaller batches based on MAX_WORKERS to avoid overloading
        results = []
        # Process in chunks - don't try to process everything at once
        chunk_size = MAX_WORKERS * 2  # Process twice as many items as workers
        
        for i in range(0, len(request.events), chunk_size):
            chunk = request.events[i:i+chunk_size]
            chunk_results = await asyncio.gather(*[process_item(item) for item in chunk])
            results.extend(chunk_results)
            logger.info(f"Processed {i+len(chunk)}/{len(request.events)} items")
        
        duration = time.time() - start_time
        avg_time = duration / len(request.events) if request.events else 0
        logger.info(f"Batch classification completed in {duration:.2f}s. Avg: {avg_time:.2f}s per item")
        
        return {"results": results}
    
    except Exception as e:
        logger.error(f"Batch classification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/categories")
async def get_categories():
    """Return all available event categories"""
    return {"categories": EVENT_CATEGORIES}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Quick sanity check - make sure the model can classify a simple text
        categories = await classify_text_async("Test event", 0.1)
        return {
            "status": "healthy", 
            "config": {
                "model": MODEL_NAME,
                "device": f"{'GPU' if DEVICE >= 0 else 'CPU'}",
                "max_workers": MAX_WORKERS,
                "max_batch_size": MAX_BATCH_SIZE
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))