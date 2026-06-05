"""
Quick integration smoke test — proves the DVSA OAuth2 token flow and one live VRM lookup.
Run from backend/ with the virtualenv active:
    python test_dvsa.py [VRN]

Uses the real DVSA API. Pass a VRN as an argument or edit DEFAULT_VRN below.
"""
import asyncio
import sys
import httpx
from dotenv import load_dotenv
import os

load_dotenv()

TOKEN_URL = "https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token"
SCOPE     = "https://tapi.dvsa.gov.uk/.default"
# Confirmed base URL: https://history.mot.api.gov.uk/v1 (proven 2026-06-05)
CANDIDATE_BASE_URLS = [
    os.environ.get("DVSA_BASE_URL", "https://history.mot.api.gov.uk/v1"),
]

DEFAULT_VRN = "AA19AAA"  # replace with a real plate for a meaningful result


async def main():
    vrn = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VRN
    vrn_clean = vrn.upper().replace(" ", "")
    client_id     = os.environ["DVSA_CLIENT_ID"]
    client_secret = os.environ["DVSA_CLIENT_SECRET"]
    api_key       = os.environ["DVSA_API_KEY"]

    print(f"--- DVSA smoke test ---")
    print(f"VRN: {vrn_clean}")

    async with httpx.AsyncClient() as client:
        # Step 1: get token
        print("\n[1] Requesting OAuth2 token...")
        r = await client.post(TOKEN_URL, data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": SCOPE,
        })
        if r.status_code != 200:
            print(f"FAILED — HTTP {r.status_code}: {r.text}")
            return
        token = r.json()["access_token"]
        print(f"OK — token received, expires in {r.json().get('expires_in', '?')}s")

        # Step 2: try each candidate URL until one works
        print(f"\n[2] Trying known endpoint candidates for {vrn_clean}...")
        headers = {"Authorization": f"Bearer {token}", "X-Api-Key": api_key}

        for base in CANDIDATE_BASE_URLS:
            if not base:
                continue
            # Try both path patterns
            paths = [
                f"{base}/trade/vehicles/registration/{vrn_clean}",
                f"{base}/trade/vehicles/mot-tests?registration={vrn_clean}",
            ]
            for url in paths:
                try:
                    print(f"    Trying: {url}")
                    r2 = await client.get(url, headers=headers, timeout=10)
                    print(f"    HTTP {r2.status_code}")
                    if r2.status_code == 200:
                        data = r2.json()
                        tests = data.get("motTests", [])
                        print(f"\nSUCCESS — {len(tests)} MOT test(s) found")
                        if tests:
                            last = tests[0]
                            print(f"  Last test: {last.get('completedDate','?')} — {last.get('testResult','?')}")
                        print(f"\n>>> Add this to your .env:\n    DVSA_BASE_URL={base}")
                        return
                    elif r2.status_code in (401, 403):
                        print(f"    Auth error — URL resolves but credentials rejected: {r2.text[:200]}")
                    elif r2.status_code == 404:
                        print(f"    404 — URL resolves, path wrong. Response: {r2.text[:100]}")
                except httpx.ConnectError:
                    print(f"    DNS failure — hostname does not resolve, skipping")
                except Exception as exc:
                    print(f"    Error: {exc}")

        print("\nNo candidate URL succeeded.")
        print("Check your DVSA welcome email for the API base URL and set DVSA_BASE_URL in .env.")


asyncio.run(main())
