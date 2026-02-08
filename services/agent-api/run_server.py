import uvicorn
import os

if __name__ == "__main__":
    # Force debug settings
    os.environ["DEBUG_AUTH"] = "true"
    os.environ["FIREBASE_PROJECT_ID"] = "hackason-grab"
    
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
