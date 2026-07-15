export type CoreSectorId = "robotics" | "innovative_medicine" | "ai_hardware" | "defense" | "power_energy";

export type CoreSectorMapping = {
  sectorId: CoreSectorId;
  sectorName: string;
  codes: string[];
};

export const coreSectorMappings: CoreSectorMapping[] = [
  { sectorId: "innovative_medicine", sectorName: "创新药/医药", codes: ["002317", "000661", "002653", "000963", "002821"] },
  { sectorId: "robotics", sectorName: "机器人", codes: ["002472", "002050", "002896", "002031", "002139"] },
  { sectorId: "ai_hardware", sectorName: "AI硬件", codes: ["000988", "000021", "000063", "002463", "002859"] },
  { sectorId: "defense", sectorName: "军工", codes: ["000738", "000768", "002625"] },
  { sectorId: "power_energy", sectorName: "电力和能源设备", codes: ["002335", "000400"] },
];

export const watchlistCodes = Array.from(new Set(coreSectorMappings.flatMap((sector) => sector.codes)));
