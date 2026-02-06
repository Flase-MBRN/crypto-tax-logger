from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import enum

# ========== CONFIG ==========
SECRET_KEY = "dein_super_geheimer_key_hier_mindestens_32_zeichen_lang"
ALGORITHM = "HS256"
DATABASE_URL = "sqlite:///./crypto_tax.db"
FREE_TX_LIMIT = 50

# ========== DATABASE SETUP ==========
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Enums
class PlanType(str, enum.Enum):
    FREE = "free"
    PRO = "pro"

class TransactionType(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"
    TRANSFER = "transfer"

class WalletType(str, enum.Enum):
    EXCHANGE = "exchange"
    WALLET = "wallet"

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    plan = Column(Enum(PlanType), default=PlanType.FREE)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    wallets = relationship("Wallet", back_populates="user")
    transactions = relationship("Transaction", back_populates="user")

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    wallet_type = Column(Enum(WalletType))
    balance_eur = Column(Float, default=0.0)
    last_synced = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="wallets")
    transactions = relationship("Transaction", back_populates="wallet")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    wallet_id = Column(Integer, ForeignKey("wallets.id"))
    tx_type = Column(Enum(TransactionType))
    from_asset = Column(String)
    to_asset = Column(String)
    amount = Column(Float)
    price_eur = Column(Float, default=0.0)
    total_eur = Column(Float, default=0.0)
    timestamp = Column(DateTime)
    tx_hash = Column(String, nullable=True)
    fifo_lot_id = Column(String, nullable=True)
    
    user = relationship("User", back_populates="transactions")
    wallet = relationship("Wallet", back_populates="transactions")

Base.metadata.create_all(bind=engine)

# ========== AUTH ==========
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_password_hash(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    expire = datetime.utcnow() + timedelta(days=7)
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=401)
        return user
    except:
        raise HTTPException(status_code=401)

# ========== FASTAPI APP ==========
app = FastAPI(title="Crypto Tax Logger")
# oben importieren
from fastapi.middleware.cors import CORSMiddleware

# nachdem `app = FastAPI(...)` steht, z.B.:
origins = [
    "https://mbrn-crypto-tax-logger.netlify.app",  # deine Netlify-URL
    "https://www.mbrn-crypto-tax-logger.netlify.app",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,      # hier kannst du auch ["*"] temporär setzen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CORS - Hardcoded für Production
ALLOWED_ORIGINS = [
    "https://mbrn-crypto-tax-logger.netlify.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    plan: PlanType = PlanType.FREE

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    plan: PlanType
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# ========== ROUTES ==========
@app.get("/")
def root():
    return {"status": "online", "app": "Crypto Tax Logger"}

@app.post("/auth/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email exists")
    
    user = User(
        name=data.name,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        plan=data.plan
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.post("/auth/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer", "user": user}

@app.get("/auth/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user

@app.get("/dashboard/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wallets = db.query(Wallet).filter(Wallet.user_id == user.id).all()
    txs = db.query(Transaction).filter(Transaction.user_id == user.id).all()
    
    return {
        "portfolio_value": sum(w.balance_eur for w in wallets),
        "total_transactions": len(txs),
        "total_wallets": len(wallets),
        "profit_loss": 0.0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)