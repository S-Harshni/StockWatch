"""Offline demo market data, used when no FINNHUB_API_KEY is configured.

Implements the four Finnhub client methods this app calls (quote, company_profile2,
company_peers, company_news) and returns payloads in Finnhub's formats, so the rest of the
backend runs unchanged. Prices follow a seeded random walk with occasional momentum bursts,
so Attention Scores, sparklines and "since you last checked" deltas all have something to
show. Every value here is SIMULATED; nothing is real market data.
"""

import random
import threading
import time
from datetime import datetime, timezone

# Public company facts (name, sector, exchange) and a rough starting price for the walk.
_COMPANIES = {
    "AAPL": ("Apple Inc", "Technology", "NASDAQ", 228.0, "1980-12-12", ["MSFT", "GOOGL", "DELL", "HPQ"]),
    "MSFT": ("Microsoft Corp", "Technology", "NASDAQ", 430.0, "1986-03-13", ["AAPL", "GOOGL", "ORCL", "CRM"]),
    "GOOGL": ("Alphabet Inc", "Media", "NASDAQ", 165.0, "2004-08-19", ["META", "MSFT", "AMZN", "NFLX"]),
    "AMZN": ("Amazon.com Inc", "Retail", "NASDAQ", 186.0, "1997-05-15", ["WMT", "COST", "GOOGL", "HD"]),
    "NVDA": ("NVIDIA Corp", "Semiconductors", "NASDAQ", 118.0, "1999-01-22", ["AMD", "INTC", "AVGO", "QCOM"]),
    "META": ("Meta Platforms Inc", "Media", "NASDAQ", 560.0, "2012-05-18", ["GOOGL", "SNAP", "PINS", "NFLX"]),
    "TSLA": ("Tesla Inc", "Automobiles", "NASDAQ", 250.0, "2010-06-29", ["F", "GM", "RIVN", "LCID"]),
    "JPM": ("JPMorgan Chase & Co", "Banking", "NYSE", 212.0, "1980-03-17", ["BAC", "WFC", "C", "GS"]),
    "V": ("Visa Inc", "Financial Services", "NYSE", 280.0, "2008-03-19", ["MA", "AXP", "PYPL", "FI"]),
    "MA": ("Mastercard Inc", "Financial Services", "NYSE", 490.0, "2006-05-25", ["V", "AXP", "PYPL", "FI"]),
    "UNH": ("UnitedHealth Group Inc", "Health Care", "NYSE", 580.0, "1984-10-17", ["CVS", "CI", "ELV", "HUM"]),
    "HD": ("Home Depot Inc", "Retail", "NYSE", 400.0, "1981-09-22", ["LOW", "WMT", "COST", "TGT"]),
    "PG": ("Procter & Gamble Co", "Consumer Products", "NYSE", 172.0, "1950-03-22", ["KO", "PEP", "CL", "KMB"]),
    "JNJ": ("Johnson & Johnson", "Pharmaceuticals", "NYSE", 162.0, "1944-09-25", ["PFE", "MRK", "ABBV", "LLY"]),
    "COST": ("Costco Wholesale Corp", "Retail", "NASDAQ", 880.0, "1985-12-05", ["WMT", "TGT", "AMZN", "BJ"]),
    "ORCL": ("Oracle Corp", "Technology", "NYSE", 170.0, "1986-03-12", ["MSFT", "SAP", "CRM", "IBM"]),
    "NFLX": ("Netflix Inc", "Media", "NASDAQ", 700.0, "2002-05-23", ["DIS", "WBD", "PARA", "ROKU"]),
    "ADBE": ("Adobe Inc", "Technology", "NASDAQ", 510.0, "1986-08-20", ["CRM", "MSFT", "INTU", "NOW"]),
    "CRM": ("Salesforce Inc", "Technology", "NYSE", 280.0, "2004-06-23", ["MSFT", "ORCL", "NOW", "ADBE"]),
    "AMD": ("Advanced Micro Devices Inc", "Semiconductors", "NASDAQ", 160.0, "1972-09-27", ["NVDA", "INTC", "QCOM", "AVGO"]),
    "PEP": ("PepsiCo Inc", "Beverages", "NASDAQ", 170.0, "1972-06-01", ["KO", "MDLZ", "KDP", "MNST"]),
    "KO": ("Coca-Cola Co", "Beverages", "NYSE", 70.0, "1919-09-05", ["PEP", "KDP", "MNST", "CELH"]),
    "WMT": ("Walmart Inc", "Retail", "NYSE", 80.0, "1972-08-25", ["COST", "TGT", "AMZN", "KR"]),
    "DIS": ("Walt Disney Co", "Media", "NYSE", 92.0, "1957-11-12", ["NFLX", "CMCSA", "WBD", "PARA"]),
    "INFY": ("Infosys Ltd", "Technology", "NYSE", 22.0, "1999-03-11", ["WIT", "ACN", "CTSH", "IBM"]),
}

_HEADLINES = [
    "{name} shares in focus as analysts revisit {sector} outlook",
    "What to watch for {name} ahead of its next earnings report",
    "{name} ({symbol}) trades {direction} as investors weigh macro data",
    "{sector} stocks move; {name} among the most active names",
    "Options activity picks up in {name} as volatility {vol}",
]


class DemoFinnhubClient:
    """Drop-in stand-in for finnhub.Client with simulated data."""

    is_demo = True

    def __init__(self, seed: int = 7):
        self._rng = random.Random(seed)
        self._lock = threading.Lock()
        self._state = {}  # symbol -> dict(price, open, high, low, prev_close, drift)

    def _company(self, symbol):
        if symbol in _COMPANIES:
            return _COMPANIES[symbol]
        base = 20 + (sum(map(ord, symbol)) % 180)
        return (f"{symbol} Holdings", "Diversified", "NYSE", float(base), "2000-01-03", [])

    def _tick(self, symbol):
        with self._lock:
            s = self._state.get(symbol)
            if s is None:
                base = self._company(symbol)[3]
                prev_close = base * (1 + self._rng.uniform(-0.02, 0.02))
                open_ = prev_close * (1 + self._rng.uniform(-0.01, 0.01))
                s = {"price": open_, "open": open_, "high": open_, "low": open_,
                     "prev_close": prev_close, "drift": self._rng.uniform(-0.0015, 0.0015)}
                self._state[symbol] = s
            # Occasional momentum regime changes make some symbols "worth a look".
            if self._rng.random() < 0.08:
                s["drift"] = self._rng.uniform(-0.004, 0.004)
            step = s["drift"] + self._rng.gauss(0, 0.0025)
            s["price"] = max(0.5, s["price"] * (1 + step))
            s["high"] = max(s["high"], s["price"])
            s["low"] = min(s["low"], s["price"])
            return dict(s)

    def quote(self, symbol):
        s = self._tick(symbol)
        change = s["price"] - s["prev_close"]
        return {
            "c": round(s["price"], 2), "d": round(change, 2), "dp": round(change / s["prev_close"] * 100, 4),
            "h": round(s["high"], 2), "l": round(s["low"], 2), "o": round(s["open"], 2),
            "pc": round(s["prev_close"], 2), "t": int(time.time()),
        }

    def company_profile2(self, symbol):
        name, sector, exchange, base, ipo, _ = self._company(symbol)
        shares = 500 + (sum(map(ord, symbol)) * 37) % 15000  # millions
        return {
            "country": "US" if symbol != "INFY" else "IN", "currency": "USD", "exchange": exchange,
            "finnhubIndustry": sector, "ipo": ipo, "logo": "", "marketCapitalization": round(base * shares, 1),
            "name": name, "shareOutstanding": float(shares), "ticker": symbol, "weburl": "",
        }

    def company_peers(self, symbol):
        return [symbol] + list(self._company(symbol)[5])

    def company_news(self, symbol, _from=None, to=None):
        name, sector = self._company(symbol)[:2]
        rng = random.Random(symbol)
        now = int(datetime.now(timezone.utc).timestamp())
        news = []
        for i, template in enumerate(rng.sample(_HEADLINES, 4)):
            news.append({
                "category": "company", "datetime": now - (i * 7 + rng.randint(1, 6)) * 3600,
                "headline": "[Demo] " + template.format(name=name, symbol=symbol, sector=sector.lower(),
                                                        direction=rng.choice(["higher", "lower"]),
                                                        vol=rng.choice(["rises", "cools"])),
                "id": abs(hash((symbol, i))) % 10**9, "image": "", "related": symbol,
                "source": "StockWatch demo feed", "summary": "Simulated headline generated in offline demo mode.",
                "url": "",
            })
        return news
