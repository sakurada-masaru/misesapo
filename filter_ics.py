import re
from datetime import datetime

def filter_ics(input_path, output_path, start_date_str):
    start_date = datetime.strptime(start_date_str, '%Y%m%d')
    
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # ヘッダー部分を取得
    header_match = re.search(r'^(.*?BEGIN:VEVENT)', content, re.DOTALL)
    header = header_match.group(1).replace('BEGIN:VEVENT', '') if header_match else "BEGIN:VCALENDAR\nVERSION:2.0\n"
    
    # イベントを抽出
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    
    filtered_events = []
    for event in events:
        # DTSTARTを探す (DTSTART;TZID=Asia/Tokyo:20260201T090000 or DTSTART:20260201T000000Z)
        dtstart_match = re.search(r'DTSTART[:;].*?:(\d{8})', event)
        if dtstart_match:
            event_date_str = dtstart_match.group(1)
            event_date = datetime.strptime(event_date_str, '%Y%m%d')
            if event_date >= start_date:
                filtered_events.append(event)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(header)
        for e in filtered_events:
            f.write(e + "\n")
        f.write("END:VCALENDAR\n")
    
    print(f"Original events: {len(events)}")
    print(f"Filtered events (from {start_date_str}): {len(filtered_events)}")

if __name__ == "__main__":
    filter_ics('/Users/sakuradamasaru/Desktop/misesapo/basic.ics', '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics', '20260201')
