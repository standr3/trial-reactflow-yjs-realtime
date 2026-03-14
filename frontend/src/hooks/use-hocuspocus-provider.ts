import { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import type { Node, Edge } from "@xyflow/react";

const getSearchParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const documentName = searchParams.get("document");
  const userName = searchParams.get("user");

  return {
    documentName,
    userName: userName ?? "",
  };
};

// extracted connection logic into hook
export const useHocuspocusProvider = () => {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [nodesMap, setNodesMap] = useState<Y.Map<Node> | null>(null);
  const [edgesMap, setEdgesMap] = useState<Y.Map<Edge> | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const { documentName, userName } = getSearchParams();

    if (!documentName) {
      return;
    }

    const provider = new HocuspocusProvider({
      url: "ws://127.0.0.1:5000",
      name: documentName,
    });

    const ydoc = provider.document;
    const nodesMap = ydoc.getMap<Node>("nodes");
    const edgesMap = ydoc.getMap<Edge>("edges");

    setProvider(provider);
    setNodesMap(nodesMap);
    setEdgesMap(edgesMap);
    setUserName(userName);

    return () => {
      provider.disconnect();
    };
  }, []);
  // parsed the document name and username from the url params
  return { provider, nodesMap, edgesMap, userName };
  
  // this allows us to dynamically change rooms and simulate diff users just by changing the url
  // this hook returns the provider instance; this obj gives us access to the awareness api we need for the cursors
};
