import os
import time
import argparse
import subprocess

from utils import get_eta

SCANNET_ROOT = "/mnt/canis/braxis/ScanNet/internal/v2/scans/"
SCANNET_SENS = "{}.sens" # scene_id
RAID_ROOT = "/mnt/raid/davech2y/"                             # TODO change this
OUTPUT_ROOT = os.path.join(RAID_ROOT, "ScanNet_frames")

if __name__ == "__main__":
    # read args
    parser = argparse.ArgumentParser()
    parser.add_argument("--scene_id", type=str, default="-1")
    parser.add_argument("--color", action="store_true")
    parser.add_argument("--depth", action="store_true")
    parser.add_argument("--pose", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    # setting
    if args.scene_id == "-1":
        scene_list = sorted(os.listdir(SCANNET_ROOT))
    else:
        if os.path.exists(os.path.join(SCANNET_ROOT, args.scene_id)):
            scene_list = [args.scene_id]
        else:
            raise ValueError("invalid scene_id")

    if not os.path.exists(OUTPUT_ROOT):
        os.mkdir(OUTPUT_ROOT)
    
    for i, scene_id in enumerate(scene_list):
        if os.path.exists(os.path.join(OUTPUT_ROOT, scene_id)): 
            print("skipping {}...".format(scene_id))
            continue
        filename = os.path.join(SCANNET_ROOT, scene_id, SCANNET_SENS.format(scene_id))
        output_path = os.path.join(OUTPUT_ROOT, scene_id)
        os.makedirs(output_path, exist_ok=True)
        cmd_line = [
            "python", "reader.py",
            "--filename", filename,
            "--output_path", output_path
        ]
        # export_color_images
        if args.color and "color" not in os.listdir(output_path):
            cmd_line.append("--export_color_images")
            color_flag = True
        else:
            color_flag = False
        # export_depth_images
        if args.depth and "depth" not in os.listdir(output_path):
            cmd_line.append("--export_depth_images")
            depth_flag = True
        else:
            depth_flag = False
        # export_poses
        if args.pose and "pose" not in os.listdir(output_path):
            cmd_line.append("--export_poses")
            pose_flag = True
        else:
            pose_flag = False
        
        # skip if exists
        if (not color_flag) and (not depth_flag) and (not pose_flag):
            print("skipping {}".format(scene_id))
            continue

        # run
        print("parsing sensor frames of {}...".format(scene_id), end="")
        start = time.time()
        if args.verbose:
            _ = subprocess.call(
                cmd_line
            )
        else:
            _ = subprocess.call(
                cmd_line, 
                stderr=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL
            )
        

        # report
        num_left = len(scene_list) - i - 1
        eta = get_eta(start, time.time(), 0, num_left)
        print("complete! {} left, ETA: {}h {}m {}s".format(
            num_left,
            eta["h"],
            eta["m"],
            eta["s"]
        ))

    print("done!")
