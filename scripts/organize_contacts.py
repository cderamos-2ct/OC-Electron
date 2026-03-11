#!/usr/bin/env python3
"""
Contact Organization System
Manages Google Contact Groups and Gmail Labels/Filters
"""
import sys
import os
sys.path.insert(0, '/Users/cderamos/antigravity-agent/scripts')
from google_helper import get_service
import json

# Relationship mapping
CONTACT_GROUPS = {
    "Family": [
        "Ashley Marie De Ramos",
        "Bella De Ramos", 
        "Christopher Dash De Ramos",
        "Janet De Ramos",
        "Jan DeRamos",
        "Tyler De Ramos"
    ],
    "In-Laws": [
        "Rob Rounds",
        "Dorene Rounds", 
        "Lois Hombaker",
        "Lois Woods"
    ],
    "VGX - Partners": [
        "Todd Delano",
        "Craig Brown",
        "Kevin Foley"
    ],
    "VGX - Staff": [
        "Brian Griffin",
        "Hung Ho",
        "Jayce Dighans",
        "Memo Hernandez"
    ]
}

GMAIL_LABELS = {
    "Family": "family",
    "In-Laws": "family/in-laws",
    "VGX - Partners": "vgx/partners",
    "VGX - Staff": "vgx/staff"
}

def create_contact_groups():
    """Create Google Contact groups"""
    people_svc = get_service("people", "v1")
    
    # List existing groups
    groups = people_svc.contactGroups().list().execute()
    existing = {g['name']: g['resourceName'] for g in groups.get('contactGroups', [])}
    
    print("📇 Creating Contact Groups...")
    for group_name in CONTACT_GROUPS.keys():
        if group_name in existing:
            print(f"  ✓ {group_name} (exists)")
        else:
            people_svc.contactGroups().create(
                body={'contactGroup': {'name': group_name}}
            ).execute()
            print(f"  ✅ {group_name} (created)")

def create_gmail_labels():
    """Create Gmail labels"""
    gmail_svc = get_service("gmail", "v1")
    
    # List existing labels
    labels = gmail_svc.users().labels().list(userId='me').execute()
    existing = {l['name'] for l in labels.get('labels', [])}
    
    print("\n🏷️  Creating Gmail Labels...")
    for label_name, label_path in GMAIL_LABELS.items():
        if label_path in existing:
            print(f"  ✓ {label_name} → {label_path} (exists)")
        else:
            gmail_svc.users().labels().create(
                userId='me',
                body={'name': label_path}
            ).execute()
            print(f"  ✅ {label_name} → {label_path} (created)")

def create_gmail_filters():
    """Create Gmail filters for auto-labeling"""
    # Note: Gmail API doesn't support filter creation directly
    # Must use Gmail settings or Apps Script
    print("\n⚠️  Gmail filters require manual setup:")
    print("   Go to Gmail → Settings → Filters → Create new filter")
    print("   Or use Google Apps Script API")
    
    # Print filter rules
    print("\n📋 Recommended Filter Rules:")
    for group, contacts in CONTACT_GROUPS.items():
        label = GMAIL_LABELS[group]
        emails = " OR ".join([f"from:{c.lower().replace(' ', '.')}" for c in contacts])
        print(f"\n{group}:")
        print(f"  From: {emails}")
        print(f"  Label: {label}")

def assign_contacts_to_groups():
    """Assign contacts to their groups"""
    people_svc = get_service("people", "v1")
    
    # Get all groups
    groups = people_svc.contactGroups().list().execute()
    group_map = {g['name']: g['resourceName'] for g in groups.get('contactGroups', [])}
    
    print("\n👥 Assigning Contacts to Groups...")
    for group_name, contact_names in CONTACT_GROUPS.items():
        if group_name not in group_map:
            print(f"  ⚠️  {group_name} group not found")
            continue
            
        group_id = group_map[group_name]
        
        for name in contact_names:
            # Search for contact
            results = people_svc.people().searchContacts(
                query=name,
                readMask="names",
                pageSize=5
            ).execute()
            
            contacts = results.get("results", [])
            if not contacts:
                print(f"  ⚠️  {name} not found")
                continue
            
            # Add to group (requires person resourceName)
            person = contacts[0].get("person", {})
            person_id = person.get("resourceName")
            
            if person_id:
                try:
                    people_svc.contactGroups().members().modify(
                        resourceName=group_id,
                        body={
                            'resourceNamesToAdd': [person_id]
                        }
                    ).execute()
                    print(f"  ✅ {name} → {group_name}")
                except Exception as e:
                    print(f"  ⚠️  {name} error: {e}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    
    if cmd == "groups" or cmd == "all":
        create_contact_groups()
    
    if cmd == "labels" or cmd == "all":
        create_gmail_labels()
    
    if cmd == "assign" or cmd == "all":
        assign_contacts_to_groups()
    
    if cmd == "filters" or cmd == "all":
        create_gmail_filters()
