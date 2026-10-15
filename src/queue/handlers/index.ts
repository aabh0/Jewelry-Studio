import type { HandlerRegistry } from "@/queue/worker";
import { genImage, genVideo, fanoutAwait, demoSleep } from "./generate";
import { productCleanPlate, productSheet } from "./product";
import { talentSheet, talentSoulTrain } from "./talent";
import { directorShotList, directorStoryboard, directorTalentExpand, directorCritique, directorBriefParse } from "./director";
import { qaImage, qaVideo } from "./qa";
import { editRun } from "./edit";
import { ffmpegRender, exportRun } from "./render";
import { providerProbe, backupSnapshot, assetIngest } from "./misc";
import { projectExportBundle, projectImportBundle } from "./bundle";

export const handlers: HandlerRegistry = {
  "asset.ingest": assetIngest as never,
  "product.clean_plate": productCleanPlate as never,
  "product.sheet": productSheet as never,
  "talent.sheet": talentSheet as never,
  "talent.soul_train": talentSoulTrain as never,
  "director.shot_list": directorShotList as never,
  "director.storyboard": directorStoryboard as never,
  "director.talent_expand": directorTalentExpand as never,
  "director.critique": directorCritique as never,
  "director.brief_parse": directorBriefParse as never,
  "gen.image": genImage as never,
  "gen.video": genVideo as never,
  "qa.image": qaImage as never,
  "qa.video": qaVideo as never,
  "edit.run": editRun as never,
  "ffmpeg.render": ffmpegRender as never,
  "export.run": exportRun as never,
  "fanout.await": fanoutAwait as never,
  "provider.probe": providerProbe as never,
  "backup.snapshot": backupSnapshot as never,
  "project.export_bundle": projectExportBundle as never,
  "project.import_bundle": projectImportBundle as never,
  "demo.sleep": demoSleep as never,
};
