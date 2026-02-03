import re

def unfold_ics(content):
    return re.sub(r'(\r?\n)+[ \t]', '', content)

with open('/Users/sakuradamasaru/Desktop/misesapo/basic.ics', 'r', encoding='utf-8') as f:
    content = unfold_ics(f.read())

events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
print(f"Total events found: {len(events)}")

for raw in events:
    if "9d284r77epjsf84rtqr8e32tk8@google.com" in raw:
        print("Found Yakitaro UID in raw event!")
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        print(f"Summary: {m_summary.group(1).strip() if m_summary else 'None'}")
        print(f"Start: {m_start.group(1).strip() if m_start else 'None'}")
        
        m_summary_all = re.search(r'SUMMARY:(.*?)(?:\r?\n[A-Z]|$)', raw, re.DOTALL)
        # SUMMARY might be multiline if not unfolded correctly, but we did unfold.
        
        if m_start:
            dtstart = m_start.group(1).strip()
            print(f"dtstart starts with 202602: {dtstart.startswith('202602')}")
