#!/usr/bin/env python3
"""
Script to apply the fixed cleanup_user_data code to lifestyle.py
Replaces lines 2514-2763 with the corrected implementation
"""

import sys
import os

def apply_fix():
    """Apply the fix to lifestyle.py"""

    # Read the original file
    original_file = os.path.join(os.path.dirname(__file__), 'lifestyle.py')
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Read the fixed code
    fixed_file = os.path.join(os.path.dirname(__file__), 'lifestyle_cleanup_fixed.py')
    with open(fixed_file, 'r', encoding='utf-8') as f:
        fixed_content = f.read()

    # Extract only the function definitions from fixed content
    # Skip the header comments
    fixed_lines = fixed_content.split('\n')
    start_idx = 0
    for i, line in enumerate(fixed_lines):
        if line.startswith('def _batch_delete_collection'):
            start_idx = i
            break

    fixed_functions = '\n'.join(fixed_lines[start_idx:])

    # Find the start and end of the section to replace in original file
    # Start: line 2514 (def _batch_delete_collection)
    # End: line 2763 (end of cleanup_user_data function)

    # Python uses 0-based indexing, so line 2514 is index 2513
    start_line = 2513  # Line 2514 in 1-based indexing
    end_line = 2763    # Line 2764 in 1-based indexing (exclusive)

    # Replace the section
    new_lines = lines[:start_line] + [fixed_functions + '\n'] + lines[end_line:]

    # Write back to the original file
    with open(original_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"✅ Successfully applied fix to {original_file}")
    print(f"   Replaced lines {start_line + 1}-{end_line} with fixed implementation")
    print(f"   Changes:")
    print(f"   - _batch_delete_collection: Now uses pagination to avoid memory issues")
    print(f"   - cleanup_user_data: Fixed error handling and response consistency")
    print(f"   - errors array: Always returns list (never None)")
    print(f"   - Placeholder strings: Fixed to use f-strings with actual uid")
    print(f"   - Parent document deletion: Separated into distinct try/except blocks")
    print(f"   - Status field: Now shows 'completed', 'partial_success', or 'failed'")

if __name__ == '__main__':
    try:
        apply_fix()
    except Exception as e:
        print(f"❌ Error applying fix: {e}", file=sys.stderr)
        sys.exit(1)
