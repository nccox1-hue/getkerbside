import os
from dotenv import load_dotenv

load_dotenv()

# DVSA MOT History API — OAuth2 client credentials
DVSA_CLIENT_ID: str = os.environ["DVSA_CLIENT_ID"]
DVSA_CLIENT_SECRET: str = os.environ["DVSA_CLIENT_SECRET"]
DVSA_API_KEY: str = os.environ["DVSA_API_KEY"]
DVSA_TOKEN_URL: str = "https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token"
DVSA_SCOPE: str = "https://tapi.dvsa.gov.uk/.default"
# Confirm exact base URL from your DVSA welcome email / API docs
# The OAuth2 scope (tapi.dvsa.gov.uk) is an Azure audience identifier — not the API hostname
DVSA_BASE_URL: str = os.environ.get("DVSA_BASE_URL", "https://history.mot.api.gov.uk/v1")

# DVLA Vehicle Enquiry Service — API key not yet received; leave blank until obtained
DVLA_API_KEY: str = os.environ.get("DVLA_API_KEY", "")
DVLA_BASE_URL: str = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"

# CORS origins — comma-separated
CORS_ORIGINS: list[str] = os.environ.get(
    "CORS_ORIGINS", "https://getkerbside.co.uk,http://localhost:3000"
).split(",")
