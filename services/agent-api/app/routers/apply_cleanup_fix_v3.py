#!/usr/bin/env python3
"""
Script to apply the fixed cleanup_user_data code v2 to lifestyle.py
Addresses Codex review findings:
- Infinite loop risk in batch delete
- list_documents compatibility issue
- Failed status logic
"""

import sys
import os

def extract_function_code(filepath: str, start_marker: str, end_marker: str = None) -> str:
    """Extract code from fixed file"""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    start_idx = None
    for i, line in enumerate(lines):
        if line.startswith(start_marker):
            start_idx = i
            break

    if start_idx is None:
        raise ValueError(f"Start marker not found: {start_marker}")

    # If no end marker, read to end of file
    if end_marker is None:
        return ''.join(lines[start_idx:])

    return ''.join(lines[start_idx:])

def apply_fix():
    """Apply the v2 fix to lifestyle.py"""

    # Read the fixed code
    fixed_file = os.path.join(os.path.dirname(__file__), 'lifestyle_cleanup_fixed_v2.py')
    fixed_code = extract_function_code(fixed_file, 'def _batch_delete_collection')

    # Read the original file
    original_file = os.path.join(os.path.dirname(__file__), 'lifestyle.py')
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Replace lines 2514-end (Python uses 0-based indexing)
    start_line = 2513  # Line 2514 in 1-based indexing

    # Build new file content
    new_lines = lines[:start_line] + [fixed_code]

    # Write back to the original file
    with open(original_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)

    print(f"✅ Successfully applied v2 fix to {original_file}")
    print(f"   Replaced lines {start_line + 1}-end with fixed implementation")
    print()
    print("📋 Summary of v2 changes:")
    print()
    print("   1. _batch_delete_collection:")
    print("      - Returns tuple (deleted_count, success_flag)")
    print("      - Added retry logic (max 3 attempts per batch)")
    print("      - Breaks loop on failure to avoid infinite loop")
    print("      - Uses select([]).stream() instead of list_documents() for SDK compatibility")
    print()
    print("   2. cleanup_user_data:")
    print("      - Checks success flag from _batch_delete_collection")
    print("      - Adds failed operations to errors array")
    print("      - Tracks total_operations for accurate status determination")
    print("      - Status logic: failed if all operations fail, partial_success if some fail")
    print()
    print("🐛 Fixed issues from Codex review:")
    print("   - [高] Infinite loop risk → Added max_retries and break on failure")
    print("   - [高] Success misreporting → Check success flag and add to errors")
    print("   - [中] list_documents compatibility → Use select([]).stream()")
    print("   - [中] Failed status logic → Count total_operations correctly")
    print()
    print("🔍 Next steps:")
    print("   1. Review the changes: diff lifestyle.py.backup_* lifestyle.py")
    print("   2. Run Codex review again to verify fixes")
    print("   3. Deploy to Cloud Run")
    print("   4. Test account deletion flow")

if __name__ == '__main__':
    try:
        apply_fix()
    except Exception as e:
        print(f"❌ Error applying fix: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
