import type { Orientation } from "../types/enums";
import { spawn } from "child_process";

export default function callReSnap(
  reSnapPath: string,
  reSnapSshkey: string,
  outputPath: string,
  orientation: Orientation,
): Promise<void> {
  console.log("Taking snapshot with resnap...");
  console.log("Resnap path:", reSnapPath);
  console.log("Resnap ssh key:", reSnapSshkey);
  console.log("Output path:", outputPath);
  console.log("Orientation:", orientation);

  return new Promise((resolve, reject) => {
    const process = spawn(reSnapPath, [
      "-k",
      reSnapSshkey,
      "-n",
      "-o",
      outputPath,
    ]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log("Command output:", stdout);
        resolve();
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        (error as any).command =
          `${reSnapPath} -k ${reSnapSshkey} -n -o ${outputPath}`;
        (error as any).exitCode = code;
        (error as any).stdout = stdout;
        (error as any).stderr = stderr;
        console.error("Command failed with error:", error);
        console.error("Error message:", error.message);
        console.error("Command:", (error as any).command);
        console.error("Exit code:", (error as any).exitCode);
        console.error("stderr:", stderr);
        reject(error);
      }
    });
  });
}
