import os
import subprocess

SCANNET_ROOT = "/mnt/canis_ScanNet/public/v2/scans/"
RAID_ROOT = "/mnt/cargo/ScanRefer/"
SOURCE_ROOT = "davech2y@char.vc.in.tum.de:/mnt/raid/davech2y/ScanNet_frames/{}/all_pose.json"
OUTPUT_ROOT = os.path.join(RAID_ROOT, "ScanNet_frames/{}")

scene_list = [scene_id for scene_id in sorted(os.listdir(SCANNET_ROOT)) if int(scene_id.split("_")[0][5:]) < 707 and scene_id.split("_")[-1] == "00"]
for scene_id in scene_list:
    print("downloading {}...".format(scene_id))
    os.makedirs(OUTPUT_ROOT.format(scene_id), exist_ok=True)

    source_path = SOURCE_ROOT.format(scene_id)
    target_path = OUTPUT_ROOT.format(scene_id)

    cmd_line = [
        "sshpass", "-p", "ch2y19940319",
        "scp",
        source_path,
        target_path
    ]
    _ = subprocess.call(cmd_line)
