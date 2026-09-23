import { createRecordHandlers } from "@/server/http-handlers";
import { createRecordsRepository } from "@/server/record-repository";

export const runtime = "nodejs";
export const { GET } = createRecordHandlers(createRecordsRepository);
