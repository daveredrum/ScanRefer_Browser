import os
import subprocess

SCANNET_ROOT = "/mnt/canis_ScanNet/public/v2/scans/"
RAID_ROOT = "/mnt/cargo/ScanRefer/"
SOURCE_ROOT = "davech2y@char.vc.in.tum.de:/mnt/raid/davech2y/ScanNet_previews/"
OUTPUT_ROOT = RAID_ROOT

source_path = SOURCE_ROOT
target_path = OUTPUT_ROOT

cmd_line = [
    "sshpass", "-p", "ch2y19940319",
    "scp", "-r",
    source_path,
    target_path
]
_ = subprocess.call(cmd_line)
