
import json
import re
import sys
import os

def analyze_html_report(file_path):
    if not os.path.exists(file_path):
        return None

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    match = re.search(r'chartData\s*=\s*(\[.*?\]);', content, re.DOTALL)
    if not match:
        return None

    try:
        data = json.loads(match.group(1))
    except:
        return None

    lib_stats = {}
    
    def get_lib_name(path):
        if 'node_modules' not in path:
            if 'app/' in path: return '[Page/Route]'
            return '[Internal]'
        
        match = re.search(r'node_modules/(?:\.pnpm/)?([^/]+(?:\+[^/]+)*|@[^/]+/[^/]+)', path)
        if match:
            name = match.group(1)
            if '.pnpm/' in path:
                name = name.split('@')[0] if not name.startswith('@') else '@' + name.split('@')[1]
            return name
        return 'other-deps'

    def flatten_groups(groups, parent_path, result_list):
        for group in groups:
            name = group.get('label', 'unknown')
            path = f"{parent_path}/{name}" if parent_path else name
            if 'parsedSize' in group and not group.get('groups'):
                result_list.append({
                    'path': path,
                    'parsedSize': group.get('parsedSize', 0),
                    'gzipSize': group.get('gzipSize', 0)
                })
            if group.get('groups'):
                flatten_groups(group['groups'], path, result_list)

    for chunk in data:
        chunk_name = chunk.get('label', 'unknown')
        if 'groups' in chunk:
            chunk_modules = []
            flatten_groups(chunk['groups'], "", chunk_modules)
            
            for mod in chunk_modules:
                lib = get_lib_name(mod['path'])
                key = (lib, chunk_name)
                if key not in lib_stats:
                    lib_stats[key] = {'parsed': 0, 'gzip': 0}
                lib_stats[key]['parsed'] += mod['parsedSize']
                lib_stats[key]['gzip'] += mod['gzipSize']

    final_stats = []
    for (lib, chunk), sizes in lib_stats.items():
        final_stats.append({
            'lib': lib,
            'chunk': chunk,
            'parsed': sizes['parsed'],
            'gzip': sizes['gzip']
        })

    final_stats.sort(key=lambda x: x['parsed'], reverse=True)
    return final_stats

if __name__ == "__main__":
    results = {
        'client': analyze_html_report(".next/analyze/client.html"),
        'server': analyze_html_report(".next/analyze/nodejs.html")
    }
    with open("scripts/bundle-analysis.json", "w") as f:
        json.dump(results, f, indent=2)
    print("Analysis saved to scripts/bundle-analysis.json")
