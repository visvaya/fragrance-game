#!/usr/bin/env python3
"""
Password Filter Utility
-----------------------
A reusable script to process large password lists (e.g., SecLists xato-10m)
and extract passwords that match specific complexity requirements.

Features:
- Filters by length and character complexity (upper, lower, digit).
- Supports large files efficiently (streaming processing).
- Outputs to TypeScript array format (for React/Next.js projects).
"""

import argparse
import os
import re
import sys
import time

def process_passwords(input_path, output_path, min_length=8, max_length=64, limit=None, mixed_case=True, digits=True):
    """
    Main processing loop.
    """
    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found.")
        sys.exit(1)

    # Compile regex patterns for performance
    has_lower = re.compile(r'[a-z]')
    has_upper = re.compile(r'[A-Z]')
    has_digit = re.compile(r'[0-9]')

    filtered_count = 0
    total_scanned = 0
    start_time = time.time()

    # Set for deduplication
    seen_passwords = set()

    try:
        with open(output_path, 'w', encoding='utf-8') as out_f:
            # Write header for the TS constant
            out_f.write('/**\n')
            out_f.write(' * Refined list of common passwords that pass complexity requirements.\n')
            out_f.write(f' * Generated from {os.path.basename(input_path)} at {time.strftime("%Y-%m-%d %H:%M:%S")}\n')
            if limit:
                out_f.write(f' * LIMITED TO TOP {limit} MATCHES.\n')
            out_f.write(' */\n')
            out_f.write('export const COMMON_PASSWORDS = [\n')
            
            with open(input_path, 'r', encoding='utf-8', errors='ignore') as in_f:
                for line in in_f:
                    total_scanned += 1
                    pwd = line.strip()
                    if not pwd:
                        continue
                    
                    # Deduplication check
                    if pwd in seen_passwords:
                        continue
                    
                    # Apply primary length filter first (fastest)
                    if len(pwd) < min_length or len(pwd) > max_length:
                        continue
                    
                    # Apply complexity requirements
                    if mixed_case and (not has_lower.search(pwd) or not has_upper.search(pwd)):
                        continue
                        
                    if digits and not has_digit.search(pwd):
                        continue
                    
                    # Password passed all checks!
                    seen_passwords.add(pwd)

                    # Escape quotes and backslashes for TS safety
                    safe_pwd = pwd.replace('\\', '\\\\').replace('"', '\\"')
                    
                    if filtered_count > 0:
                        out_f.write(',\n')
                    
                    out_f.write(f'    "{safe_pwd}"')
                    filtered_count += 1
                    
                    # Check limit
                    if limit and filtered_count >= limit:
                        print(f"    [!] Reached limit of {limit} passwords.")
                        break
                    
                    # Progress update every 1M lines
                    if total_scanned % 1000000 == 0:
                        print(f"    [>] Scanned {total_scanned/1000000:.0f}M lines, found {filtered_count} matches...")

            out_f.write('\n];\n')

    except Exception as e:
        print(f"[!] Error during processing: {e}")
        sys.exit(1)

    duration = time.time() - start_time
    print("-" * 50)
    print(f"[+] SUCCESS: Processed {total_scanned} passwords in {duration:.2f}s")
    print(f"[+] Extracted {filtered_count} complex common passwords.")
    print(f"[+] Output saved to: {output_path}")
    print("-" * 50)

def main():
    parser = argparse.ArgumentParser(description="Professional Password Filter for Blacklists")
    parser.add_argument("-i", "--input", default="xato-net-10-million-passwords-dup.txt", help="Path to raw password list")
    parser.add_argument("-o", "--output", default="common-passwords.ts", help="Path to output .ts file")
    parser.add_argument("-l", "--min-length", type=int, default=8, help="Minimum password length")
    parser.add_argument("-m", "--max-length", type=int, default=64, help="Maximum password length (default: 64)")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of output passwords (e.g. 10000)")
    parser.add_argument("--no-mixed-case", action="store_false", dest="mixed_case", help="Disable mixed case check")
    parser.add_argument("--no-digits", action="store_false", dest="digits", help="Disable digits check")

    args = parser.parse_args()

    # If paths are relative, resolve them from the script's directory for predictability
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    input_resolved = args.input if os.path.isabs(args.input) else os.path.join(base_dir, args.input)
    output_resolved = args.output if os.path.isabs(args.output) else os.path.join(base_dir, args.output)

    process_passwords(
        input_resolved, 
        output_resolved, 
        min_length=args.min_length,
        max_length=args.max_length,
        limit=args.limit,
        mixed_case=args.mixed_case, 
        digits=args.digits
    )

if __name__ == "__main__":
    main()
