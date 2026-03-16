import type * as Y from "yjs";
import { GraphCommandService } from "../app/graphCommandService";
import { YjsGraphRepository } from "./yjsGraphRepository";
import type { GraphAction } from "../domain/types";

export function runGraphAction(ydoc: Y.Doc, action: GraphAction) {
  const repository = new YjsGraphRepository(ydoc);
  const service = new GraphCommandService(repository);
  return service.execute(action);
}
