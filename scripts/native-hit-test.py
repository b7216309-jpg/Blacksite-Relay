"""Read-only WM_NCHITTEST probes. Never moves, focuses or clicks a window."""
import ctypes, json, sys
from ctypes import wintypes
u = ctypes.WinDLL('user32', use_last_error=True)
u.SendMessageTimeoutW.argtypes = [wintypes.HWND,wintypes.UINT,wintypes.WPARAM,wintypes.LPARAM,wintypes.UINT,wintypes.UINT,ctypes.POINTER(ctypes.c_size_t)]
u.SendMessageTimeoutW.restype = wintypes.LPARAM
u.GetClientRect.argtypes=[wintypes.HWND,ctypes.POINTER(wintypes.RECT)]
u.ClientToScreen.argtypes=[wintypes.HWND,ctypes.POINTER(wintypes.POINT)]
client=wintypes.RECT();origin=wintypes.POINT(0,0)
u.GetClientRect(int(sys.argv[1]),ctypes.byref(client));u.ClientToScreen(int(sys.argv[1]),ctypes.byref(origin))
viewport=json.loads(sys.argv[3]) if len(sys.argv)>3 else None
result=[]
for p in json.loads(sys.argv[2]):
    if viewport:
        p={**p,'localX':p['x'],'localY':p['y'],'x':origin.x+round(p['x']*client.right/viewport[0]),'y':origin.y+round(p['y']*client.bottom/viewport[1])}
    packed=(int(p['x']) & 65535) | ((int(p['y']) & 65535)<<16)
    reply=ctypes.c_size_t()
    ok=u.SendMessageTimeoutW(int(sys.argv[1]),0x84,0,packed,2,2500,ctypes.byref(reply))
    if not ok: raise ctypes.WinError(ctypes.get_last_error())
    value=ctypes.c_ssize_t(reply.value).value
    result.append({**p,'hit':value,'name':{0:'HTNOWHERE',1:'HTCLIENT',2:'HTCAPTION'}.get(value,str(value))})
print(json.dumps(result))
