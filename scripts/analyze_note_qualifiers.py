"""
Analyze dataset to detect multi-word patterns in Accords and Notes.
This script detects potential qualifier words that should be removed during note/accord normalization.

Usage:
    python analyze_note_qualifiers.py

Output:
    - qualifier_analysis.csv: Detailed breakdown of multi-word patterns
    - Console: Summary statistics and recommendations
"""

import pandas as pd
import re
from collections import Counter
from typing import List, Set

# Configuration
CSV_PATH = '../data/dataset.csv'
DELIMITER = ';'

def load_data():
    """Load dataset with proper encoding."""
    return pd.read_csv(CSV_PATH, delimiter=DELIMITER, encoding='utf-8')

def extract_items(text: str) -> List[str]:
    """Extract individual items from comma-separated string."""
    if pd.isna(text) or text == '':
        return []
    return [item.strip() for item in str(text).split(',') if item.strip()]

def analyze_multiword_items(items: List[str]) -> dict:
    """Analyze items and extract suffix words and trailing special characters."""
    results = {
        'single_word': [],
        'multi_word': [],
        'prefix_words': Counter(),  # 1st word of multi-word items
        'prefix_examples': {},     # {word: set(example_strings)}
        'suffix_words': Counter(),  # Words that appear after 1st word
        'suffix_examples': {},     # {word: set(example_strings)}
        'special_chars': Counter(), # Trailing special character patterns
        'special_examples': {},    # {char: set(example_strings)}
    }
    
    for item in items:
        if not item:
            continue
            
        # Detect ANY non-word characters at the end of the item OR at the end of words within the item
        all_trailing_specials = re.findall(r'([^\w\s\)-])(?=\s|$)', item)
        if all_trailing_specials:
            for char in set(all_trailing_specials):
                results['special_chars'][char] += 1
                if char not in results['special_examples']:
                    results['special_examples'][char] = set()
                if len(results['special_examples'][char]) < 3:
                    results['special_examples'][char].add(item)
        
        # Split into words for analysis
        words = item.split()
        
        if len(words) == 1:
            results['single_word'].append(item)
        else:
            results['multi_word'].append(item)
            
            # Analyze Prefix (1st word)
            first_word = re.sub(r'[^\w\s-]', '', words[0]).lower()
            if first_word:
                results['prefix_words'][first_word] += 1
                if first_word not in results['prefix_examples']:
                    results['prefix_examples'][first_word] = set()
                if len(results['prefix_examples'][first_word]) < 3:
                    results['prefix_examples'][first_word].add(item)

            # Analyze Suffixes (all words after the first)
            for word in words[1:]:
                clean_word = re.sub(r'[^\w\s-]', '', word).lower()
                if clean_word:
                    results['suffix_words'][clean_word] += 1
                    if clean_word not in results['suffix_examples']:
                        results['suffix_examples'][clean_word] = set()
                    if len(results['suffix_examples'][clean_word]) < 3:
                        results['suffix_examples'][clean_word].add(item)
    
    return results

def main():
    print("Loading dataset...")
    df = pd.read_csv(CSV_PATH, delimiter=DELIMITER, encoding='utf-8')
    
    print(f"Total rows: {len(df)}")
    
    # Analyze Notes (Top, Middle, Base)
    print("\n" + "="*80)
    print("ANALYZING NOTES (Top, Middle, Base)")
    print("="*80)
    
    all_notes = []
    for column in ['Top Notes', 'Middle Notes', 'Base Notes']:
        column_notes = []
        for idx, row in df.iterrows():
            notes = extract_items(row[column])
            column_notes.extend(notes)
        
        print(f"\n{column}:")
        print(f"  Total instances: {len(column_notes)}")
        print(f"  Unique: {len(set(column_notes))}")
        
        all_notes.extend(column_notes)
    
    print(f"\nAll Notes combined:")
    print(f"  Total instances: {len(all_notes)}")
    print(f"  Unique notes: {len(set(all_notes))}")
    
    note_analysis = analyze_multiword_items(all_notes)
    
    print(f"\nSingle-word notes: {len(note_analysis['single_word'])}")
    print(f"Multi-word notes: {len(note_analysis['multi_word'])}")
    
    if note_analysis['special_chars']:
        print(f"\nSpecial characters found in notes: {dict(note_analysis['special_chars'])}")
    
    print(f"\nTop 50 PREFIX words in Notes (potential qualifiers like 'African'):")
    for word, count in note_analysis['prefix_words'].most_common(50):
        print(f"  '{word}': {count}")

    print(f"\nTop 50 SUFFIX words in Notes (potential qualifiers like 'absolute'):")
    for word, count in note_analysis['suffix_words'].most_common(50):
        print(f"  '{word}': {count}")
    
    # Export detailed results
    export_data = []
    
    # Add special chars
    for char, count in note_analysis['special_chars'].items():
        export_data.append({
            'source': 'Notes',
            'type': 'special_char',
            'text': char,
            'count': count,
            'examples': " | ".join(note_analysis['special_examples'].get(char, []))
        })

    # Add prefix words
    for word, count in note_analysis['prefix_words'].most_common():
        export_data.append({
            'source': 'Notes',
            'type': 'prefix_word',
            'text': word,
            'count': count,
            'examples': " | ".join(note_analysis['prefix_examples'].get(word, []))
        })

    # Add note suffixes
    for word, count in note_analysis['suffix_words'].most_common():
        export_data.append({
            'source': 'Notes',
            'type': 'suffix_word',
            'text': word,
            'count': count,
            'examples': " | ".join(note_analysis['suffix_examples'].get(word, []))
        })
    
    export_df = pd.DataFrame(export_data)
    export_df.to_csv('qualifier_analysis.csv', sep=';', index=False, encoding='utf-8-sig')
    print(f"\n✅ Detailed analysis exported to: qualifier_analysis.csv")
    
    print("\n" + "="*80)
    print("QUALIFIER RECOMMENDATIONS FOR NOTES")
    print("="*80)
    
    print("\n[PREFIXES] Consider removing these (occurring >50 times):")
    high_freq_prefixes = [word for word, count in note_analysis['prefix_words'].items() if count > 50]
    for word in sorted(high_freq_prefixes):
        print(f"  - {word}")

    print("\n[SUFFIXES] Consider removing these (occurring >50 times):")
    high_freq_suffixes = [word for word, count in note_analysis['suffix_words'].items() if count > 50]
    for word in sorted(high_freq_suffixes):
        print(f"  - {word}")

if __name__ == '__main__':
    main()
