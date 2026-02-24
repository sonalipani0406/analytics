# GCP OAuth2 Configuration
import os
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# GCP OAuth2 Configuration
GCP_CLIENT_ID = "753011261618-k46db0seqt8d5m0lljb14378ogrium9f.apps.googleusercontent.com"
ALLOWED_DOMAIN = "rbg.iitm.ac.in"
JWT_SECRET_KEY = "super-long-and-secure-secret-key"  # Change

# Token verification
def verify_gcp_token(token):
    """
    Verify GCP ID token and return user info
    """
    try:
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GCP_CLIENT_ID)
        
        # Verify token hasn't expired
        if idinfo['exp'] < __import__('time').time():
            raise ValueError('Token expired')
        
        return idinfo
    except Exception as e:
        print(f"Token verification failed: {str(e)}")
        return None

def is_allowed_email(email):
    """
    Check if email domain is allowed
    """
    if not email:
        return False
    domain = email.split('@')[1] if '@' in email else ''
    return domain.lower() == ALLOWED_DOMAIN.lower()

def extract_user_info(idinfo):
    """
    Extract user information from ID token
    """
    if not idinfo:
        return None
    
    email = idinfo.get('email', '')
    
    # Verify email domain
    if not is_allowed_email(email):
        return None
    
    return {
        'email': email,
        'name': idinfo.get('name', ''),
        'picture': idinfo.get('picture', ''),
        'sub': idinfo.get('sub', '')  # Google user ID
    }
