# Antigravity Short-Code Geo-Bypass Smoke Test

**Date**: 2026-03-18  
**Verdict**: ✅ **PASS**

---

## Environment

| Item | Value |
|------|-------|
| Detected country | **VN** (Vietnam) |
| Public IP | 113.190.52.66 |
| Geolocation API | ip-api.com |

## Smoke Link

| Item | Value |
|------|-------|
| Short code | `AGSMOKE1` |
| Scan URL | `https://r.worldgate.space/AGSMOKE1` |
| Bypass URL | `https://qrlive-jp-proxy.fly.dev/` |
| Geo route | VN → bypass |

## HTTP Redirect Result

| Item | Value |
|------|-------|
| HTTP status | **302 Found** |
| `Location` header | `https://qrlive-jp-proxy.fly.dev/` |
| Edge region | `ap-northeast-2` |
| Match? | ✅ Location host = expected bypass host |

## Analytics Verification

| Item | Value |
|------|-------|
| Latest click exists | ✅ Yes |
| `country_code` | **VN** |
| Matches expected | ✅ Yes |
| Referer | `direct` |
| Script exit code | 0 (PASS) |

## Cleanup

| Item | Value |
|------|-------|
| Link deleted | ✅ `true` |
| Geo routes deleted | ✅ |
| Click events deleted | ✅ |

---

## Unresolved Questions

None.
