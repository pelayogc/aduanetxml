"use server";

import { revalidatePath } from "next/cache";
import { syncAduanetXmlFolders } from "@/lib/customs/service";

export async function syncAduanetXmlNow() {
  await syncAduanetXmlFolders();
  revalidatePath("/aduanetxml");
}
