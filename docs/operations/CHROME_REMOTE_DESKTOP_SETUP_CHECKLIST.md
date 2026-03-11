# Chrome Remote Desktop Setup Checklist

## Goal
Set up this Mac for practical remote access from iPhone/iPad using Chrome Remote Desktop.

---

## On the Mac

### 1) Install / open Chrome
Make sure Google Chrome is installed and signed into the Google account you want to use for remote access.

### 2) Open the setup page
Go to:
- <https://remotedesktop.google.com/access>

### 3) Enable remote access
- click **Set up remote access**
- install the host component if prompted
- choose a computer name
- choose a PIN (6+ digits)

### 4) Grant macOS permissions
Check these in:
- **System Settings → Privacy & Security**

Expected permissions:
- **Accessibility** → allow Chrome / Chrome Remote Desktop host
- **Screen Recording** → allow Chrome / Chrome Remote Desktop host

If remote control works badly later, this is the first place to check.

### 5) Power / sleep sanity check
For reliable remote access, the Mac should not go to sleep aggressively.

Check:
- display sleep vs full system sleep behavior
- whether the Mac stays awake when plugged in
- whether any energy saver / lock behavior is too aggressive for remote use

---

## On iPhone / iPad

### 1) Install app
Install **Chrome Remote Desktop** from the App Store.

### 2) Sign in
Use the same Google account used on the Mac.

### 3) Connect
- select the Mac from the device list
- enter the PIN

---

## Quick test
After setup, confirm all of these:
- the Mac appears in the mobile app
- the session opens
- you can see the screen clearly
- taps/clicks register
- keyboard input works
- scrolling/zooming is usable

---

## If it fails
Check these in order:
1. same Google account on both ends
2. Mac is powered on
3. Mac is online
4. host install completed
5. Accessibility permission granted
6. Screen Recording permission granted
7. Mac is not asleep

---

## Best-use guidance
Use Chrome Remote Desktop for:
- quick remote checks
- launching apps or scripts
- light admin work
- emergency control from phone/tablet

Prefer iPad over iPhone when possible.
Phone is fine for quick triage, but lousy for sustained work.
