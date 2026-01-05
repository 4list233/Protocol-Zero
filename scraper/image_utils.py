"""
Image Utilities Module for Protocol Zero Taobao Scraper

This module provides image processing utilities:
  - Perceptual hash (pHash) based deduplication
  - Size filtering (minimum dimensions)
  - Image quality assessment
  - Batch deduplication for folders

Designed to reduce manual cleanup work by automatically
identifying and removing duplicate/low-quality images.
"""

import os
import logging
from dataclasses import dataclass
from typing import List, Dict, Set, Tuple, Optional
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ImageInfo:
    """Information about an image file."""
    path: str
    filename: str
    size_bytes: int
    width: int
    height: int
    phash: Optional[str] = None  # Perceptual hash
    is_valid: bool = True
    duplicate_of: Optional[str] = None  # Path to the original if this is a duplicate
    invalid_reason: Optional[str] = None  # Reason for invalid classification


# Minimum dimensions for valid product images
MIN_WIDTH = 200
MIN_HEIGHT = 200
MIN_FILE_SIZE = 5000  # 5KB minimum

# Aspect ratio thresholds for filtering banners/strips
MIN_ASPECT_RATIO = 0.3  # Very tall/narrow images
MAX_ASPECT_RATIO = 3.0  # Very wide banners

# Entropy threshold for blank/solid color detection
MIN_ENTROPY = 1.0  # Images with entropy below this are likely blank

# pHash similarity threshold (lower = more similar)
# Images with hamming distance <= this value are considered duplicates
PHASH_THRESHOLD = 8


def compute_phash(image_path: str) -> Optional[str]:
    """
    Compute the perceptual hash (pHash) of an image.
    
    pHash is robust to minor changes in size, compression, and color adjustments.
    Two images with similar visual content will have similar pHash values.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Hex string of the pHash, or None if computation failed
    """
    try:
        from PIL import Image
        import imagehash
        
        with Image.open(image_path) as img:
            # Convert to RGB if necessary
            if img.mode not in ('RGB', 'L'):
                img = img.convert('RGB')
            
            # Compute perceptual hash
            phash = imagehash.phash(img)
            return str(phash)
            
    except ImportError:
        logger.warning("imagehash or PIL not installed. Install with: pip install imagehash Pillow")
        return None
    except Exception as e:
        logger.debug(f"Failed to compute pHash for {image_path}: {e}")
        return None


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Compute the Hamming distance between two pHash hex strings.
    
    Lower distance = more similar images.
    Distance of 0 = identical images.
    Distance <= 8 typically indicates visually similar images.
    
    Args:
        hash1: First pHash hex string
        hash2: Second pHash hex string
        
    Returns:
        Hamming distance (number of differing bits)
    """
    if not hash1 or not hash2:
        return float('inf')
    
    try:
        from imagehash import hex_to_hash
        
        h1 = hex_to_hash(hash1)
        h2 = hex_to_hash(hash2)
        return h1 - h2  # imagehash overloads - to return Hamming distance
        
    except ImportError:
        # Fallback: compute manually
        try:
            int1 = int(hash1, 16)
            int2 = int(hash2, 16)
            xor = int1 ^ int2
            return bin(xor).count('1')
        except:
            return float('inf')
    except Exception:
        return float('inf')


def compute_image_entropy(image_path: str) -> float:
    """
    Compute the Shannon entropy of an image.
    
    Low entropy = solid color / blank image.
    High entropy = complex image with detail.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Entropy value (0.0 to ~8.0), or -1.0 if failed
    """
    try:
        from PIL import Image
        import math
        
        with Image.open(image_path) as img:
            # Convert to grayscale for simpler entropy calculation
            gray = img.convert('L')
            histogram = gray.histogram()
            
            # Calculate entropy
            total_pixels = sum(histogram)
            if total_pixels == 0:
                return 0.0
            
            entropy = 0.0
            for count in histogram:
                if count > 0:
                    p = count / total_pixels
                    entropy -= p * math.log2(p)
            
            return entropy
            
    except Exception as e:
        logger.debug(f"Failed to compute entropy for {image_path}: {e}")
        return -1.0


def get_aspect_ratio(width: int, height: int) -> float:
    """
    Calculate aspect ratio (width / height).
    
    Returns:
        Aspect ratio, or 1.0 if dimensions are invalid
    """
    if height <= 0:
        return 1.0
    return width / height


def get_image_dimensions(image_path: str) -> Tuple[int, int]:
    """
    Get the width and height of an image.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Tuple of (width, height), or (0, 0) if failed
    """
    try:
        from PIL import Image
        
        with Image.open(image_path) as img:
            return img.size
            
    except Exception as e:
        logger.debug(f"Failed to get dimensions for {image_path}: {e}")
        return (0, 0)


def analyze_image(image_path: str) -> ImageInfo:
    """
    Analyze a single image and return its information.
    
    Performs multiple quality checks:
    - Minimum size (file size and dimensions)
    - Aspect ratio (filters extreme banners)
    - Entropy (filters blank/solid color images)
    
    Args:
        image_path: Path to the image file
        
    Returns:
        ImageInfo with all available metadata
    """
    path = Path(image_path)
    
    # Basic file info
    try:
        size_bytes = path.stat().st_size
    except:
        size_bytes = 0
    
    # Get dimensions
    width, height = get_image_dimensions(image_path)
    
    # Compute pHash
    phash = compute_phash(image_path)
    
    # Compute entropy for blank detection
    entropy = compute_image_entropy(image_path)
    
    # Compute aspect ratio
    aspect_ratio = get_aspect_ratio(width, height)
    
    # Determine validity with detailed reason
    is_valid = True
    invalid_reason = None
    
    if size_bytes < MIN_FILE_SIZE:
        is_valid = False
        invalid_reason = f"file_too_small ({size_bytes} bytes)"
    elif width < MIN_WIDTH or height < MIN_HEIGHT:
        is_valid = False
        invalid_reason = f"dimensions_too_small ({width}x{height})"
    elif aspect_ratio < MIN_ASPECT_RATIO:
        is_valid = False
        invalid_reason = f"too_narrow (aspect_ratio={aspect_ratio:.2f})"
    elif aspect_ratio > MAX_ASPECT_RATIO:
        is_valid = False
        invalid_reason = f"too_wide_banner (aspect_ratio={aspect_ratio:.2f})"
    elif entropy >= 0 and entropy < MIN_ENTROPY:
        is_valid = False
        invalid_reason = f"low_entropy_blank (entropy={entropy:.2f})"
    
    return ImageInfo(
        path=str(path.absolute()),
        filename=path.name,
        size_bytes=size_bytes,
        width=width,
        height=height,
        phash=phash,
        is_valid=is_valid,
        invalid_reason=invalid_reason
    )


def find_duplicates(images: List[ImageInfo], threshold: int = PHASH_THRESHOLD) -> List[ImageInfo]:
    """
    Find duplicate images based on perceptual hash similarity.
    
    The first occurrence of each unique image is kept as the "original",
    and subsequent similar images are marked as duplicates.
    
    Args:
        images: List of ImageInfo objects with computed pHashes
        threshold: Maximum Hamming distance to consider as duplicate
        
    Returns:
        Updated list with duplicate_of field set for duplicates
    """
    # Filter to images with valid pHashes
    hashable = [img for img in images if img.phash]
    
    if not hashable:
        return images
    
    # Track seen hashes and their original paths
    originals: List[Tuple[str, str]] = []  # (phash, path)
    
    for img in hashable:
        is_duplicate = False
        
        for orig_hash, orig_path in originals:
            distance = hamming_distance(img.phash, orig_hash)
            if distance <= threshold:
                img.duplicate_of = orig_path
                is_duplicate = True
                break
        
        if not is_duplicate:
            originals.append((img.phash, img.path))
    
    return images


def deduplicate_folder(
    folder_path: str, 
    threshold: int = PHASH_THRESHOLD,
    delete_duplicates: bool = False,
    min_width: int = MIN_WIDTH,
    min_height: int = MIN_HEIGHT
) -> Dict[str, List[str]]:
    """
    Find and optionally remove duplicate/invalid images in a folder.
    
    Args:
        folder_path: Path to the folder to process
        threshold: pHash similarity threshold
        delete_duplicates: If True, delete duplicate files
        min_width: Minimum image width
        min_height: Minimum image height
        
    Returns:
        Dict with 'kept', 'duplicates', and 'invalid' lists of file paths
    """
    folder = Path(folder_path)
    
    if not folder.exists():
        logger.error(f"Folder not found: {folder_path}")
        return {'kept': [], 'duplicates': [], 'invalid': []}
    
    # Find all image files
    image_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}
    image_files = [
        f for f in folder.iterdir() 
        if f.is_file() and f.suffix.lower() in image_extensions
    ]
    
    if not image_files:
        logger.info(f"No images found in {folder_path}")
        return {'kept': [], 'duplicates': [], 'invalid': []}
    
    logger.info(f"Analyzing {len(image_files)} images in {folder_path}...")
    
    # Analyze all images
    analyzed = [analyze_image(str(f)) for f in image_files]
    
    # Find invalid images (too small)
    invalid = [img for img in analyzed if not img.is_valid]
    valid = [img for img in analyzed if img.is_valid]
    
    # Find duplicates among valid images
    find_duplicates(valid, threshold)
    
    duplicates = [img for img in valid if img.duplicate_of]
    kept = [img for img in valid if not img.duplicate_of]
    
    # Log results
    logger.info(f"  Kept: {len(kept)}")
    logger.info(f"  Duplicates: {len(duplicates)}")
    logger.info(f"  Invalid (too small): {len(invalid)}")
    
    # Optionally delete duplicates and invalid files
    if delete_duplicates:
        for img in duplicates + invalid:
            try:
                os.remove(img.path)
                logger.info(f"  Deleted: {img.filename}")
            except Exception as e:
                logger.error(f"  Failed to delete {img.filename}: {e}")
    
    return {
        'kept': [img.path for img in kept],
        'duplicates': [img.path for img in duplicates],
        'invalid': [img.path for img in invalid]
    }


def deduplicate_product_media(
    product_folder: str,
    delete_duplicates: bool = False
) -> Dict[str, Dict[str, List[str]]]:
    """
    Deduplicate images across all subfolders of a product media folder.
    
    Expected structure:
        product_folder/
            Main/
            Catalogue/
            Details/
    
    Args:
        product_folder: Path to the product's media folder
        delete_duplicates: If True, delete duplicate files
        
    Returns:
        Dict mapping subfolder name to deduplication results
    """
    product_path = Path(product_folder)
    
    if not product_path.exists():
        logger.error(f"Product folder not found: {product_folder}")
        return {}
    
    results = {}
    
    for subfolder in ['Main', 'Catalogue', 'Details']:
        subfolder_path = product_path / subfolder
        if subfolder_path.exists():
            results[subfolder] = deduplicate_folder(
                str(subfolder_path),
                delete_duplicates=delete_duplicates
            )
    
    return results


def batch_deduplicate_media(
    media_root: str,
    delete_duplicates: bool = False
) -> Dict[str, int]:
    """
    Batch deduplicate all product folders in the media directory.
    
    Args:
        media_root: Root media directory containing product folders
        delete_duplicates: If True, delete duplicate files
        
    Returns:
        Summary dict with total counts
    """
    media_path = Path(media_root)
    
    if not media_path.exists():
        logger.error(f"Media root not found: {media_root}")
        return {'products': 0, 'kept': 0, 'duplicates': 0, 'invalid': 0}
    
    # Find all product folders
    product_folders = [
        f for f in media_path.iterdir()
        if f.is_dir() and f.name.startswith('product_')
    ]
    
    logger.info(f"Processing {len(product_folders)} product folders...")
    
    total_kept = 0
    total_duplicates = 0
    total_invalid = 0
    
    for product_folder in product_folders:
        results = deduplicate_product_media(
            str(product_folder),
            delete_duplicates=delete_duplicates
        )
        
        for subfolder, result in results.items():
            total_kept += len(result.get('kept', []))
            total_duplicates += len(result.get('duplicates', []))
            total_invalid += len(result.get('invalid', []))
    
    logger.info(f"\nBatch deduplication complete:")
    logger.info(f"  Total products: {len(product_folders)}")
    logger.info(f"  Total kept: {total_kept}")
    logger.info(f"  Total duplicates: {total_duplicates}")
    logger.info(f"  Total invalid: {total_invalid}")
    
    return {
        'products': len(product_folders),
        'kept': total_kept,
        'duplicates': total_duplicates,
        'invalid': total_invalid
    }


# CLI interface
if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Image deduplication utility for Protocol Zero scraper'
    )
    parser.add_argument(
        'path',
        help='Path to media folder or specific folder to deduplicate'
    )
    parser.add_argument(
        '--delete',
        action='store_true',
        help='Actually delete duplicate and invalid images'
    )
    parser.add_argument(
        '--threshold',
        type=int,
        default=PHASH_THRESHOLD,
        help=f'pHash similarity threshold (default: {PHASH_THRESHOLD})'
    )
    parser.add_argument(
        '--batch',
        action='store_true',
        help='Process all product folders in the given media root'
    )
    
    args = parser.parse_args()
    
    if args.batch:
        batch_deduplicate_media(args.path, delete_duplicates=args.delete)
    else:
        deduplicate_folder(args.path, threshold=args.threshold, delete_duplicates=args.delete)
