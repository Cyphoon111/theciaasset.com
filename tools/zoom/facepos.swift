// Prints the face rectangle in an image using macOS's own face detector (Vision).
//   swift facepos.swift image.png   →  "face cx=0.512 cy=0.431 w=0.18 h=0.26"  (fractions of the image; cy from the top)
// Used to measure centring of the on-air picture objectively (2026-10-26).
import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("no image"); exit(1) }
let req = VNDetectFaceRectanglesRequest()
try VNImageRequestHandler(cgImage: cg, options: [:]).perform([req])
guard let faces = req.results, !faces.isEmpty else { print("no face"); exit(2) }
let f = faces.max(by: { $0.boundingBox.width < $1.boundingBox.width })!.boundingBox   // the largest face; origin bottom-left
print(String(format: "face cx=%.3f cy=%.3f w=%.3f h=%.3f", f.midX, 1 - f.midY, f.width, f.height))
