#!/usr/bin/env python3
"""Gmail label management for AntiGravity"""

import sys
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def get_service(account='work'):
    """Get Gmail API service"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    token_file = os.path.join(script_dir, f'google_token_{account}.json')
    
    if not os.path.exists(token_file):
        token_file = os.path.join(script_dir, 'google_token.json')
    
    if not os.path.exists(token_file):
        print(f"❌ No token file found. Run: python3 scripts/google_reauth.py")
        sys.exit(1)
    
    creds = Credentials.from_authorized_user_file(token_file)
    return build('gmail', 'v1', credentials=creds)

def list_labels():
    """List all Gmail labels"""
    service = get_service()
    results = service.users().labels().list(userId='me').execute()
    labels = results.get('labels', [])
    
    system_labels = [l for l in labels if l['type'] == 'system']
    user_labels = [l for l in labels if l['type'] == 'user']
    
    print('=== SYSTEM LABELS ===')
    for label in sorted(system_labels, key=lambda x: x['name']):
        print(f"  {label['name']}")
    
    print('\n=== USER LABELS ===')
    for label in sorted(user_labels, key=lambda x: x['name']):
        print(f"  {label['name']} (id: {label['id']})")
    
    return user_labels

def create_label(name):
    """Create a new Gmail label"""
    service = get_service()
    label_object = {
        'name': name,
        'labelListVisibility': 'labelShow',
        'messageListVisibility': 'show'
    }
    
    result = service.users().labels().create(userId='me', body=label_object).execute()
    print(f"✅ Created: {result['name']}")
    return result

def delete_label(label_id):
    """Delete a Gmail label"""
    service = get_service()
    service.users().labels().delete(userId='me', id=label_id).execute()
    print(f"🗑️  Deleted: {label_id}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 gmail_labels.py <list|create|delete> [args]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    
    if cmd == 'list':
        list_labels()
    elif cmd == 'create' and len(sys.argv) >= 3:
        create_label(sys.argv[2])
    elif cmd == 'delete' and len(sys.argv) >= 3:
        delete_label(sys.argv[2])
    else:
        print("Invalid command")
        sys.exit(1)
