import "./App.css";
import "@xyflow/react/dist/style.css";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { getNewNodeData } from "./utils/get-new-node-data";
import { useHocuspocusProvider } from "./hooks/use-hocuspocus-provider";
// import { HocuspocusProvider } from "@hocuspocus/provider";

type CursorPosition = { x: number; y: number };

type AwarenessUserData = {
  userName: string;
  cursorPosition: CursorPosition;
};

const Cursor = ({ cursorPosition, userName }: AwarenessUserData) => {
  return (
    <div
      className="cursor"
      style={{ top: cursorPosition.y, left: cursorPosition.x }}
    >
      <div className="pointer"></div>
      <div className="name-badge">{userName}</div>
    </div>
  );
};

// const provider = new HocuspocusProvider({
//   url: "ws://127.0.0.1:5000",
//   name: "reactflow-yjs",
// });

// const ydoc = provider.document;
// // live data structures; instantly propagate changes to other clients
// const nodesMap = ydoc.getMap<Node>("nodes");
// const edgesMap = ydoc.getMap<Edge>("edges");

export const App = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const { provider, nodesMap, edgesMap, userName } = useHocuspocusProvider();
  const [awareness, setAwareness] = useState<AwarenessUserData[]>([]);
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();

  //observer maps for changes
  useEffect(() => {
    if (!nodesMap || !edgesMap) {
      return;
    }

    // define the callbacks that update the local state when shared state changes
    const nodesObserver = () => {
      setNodes(Array.from(nodesMap.values()));
    };
    const edgesObserver = () => {
      setEdges(Array.from(edgesMap.values()));
    };
    // call the observers once when the component mounts to sync initial state
    nodesObserver();
    edgesObserver();

    // observers are triggered on changes
    nodesMap.observe(nodesObserver);
    edgesMap.observe(edgesObserver);

    return () => {
      // unobserve when component unmounts to prevent memory leaks or duplicate event handling
      nodesMap.unobserve(nodesObserver);
      edgesMap.unobserve(edgesObserver);
    };
  }, [nodesMap, edgesMap]);

  const addNode = () => {
    if (!nodesMap) return;
    const nodeData = getNewNodeData();
    nodesMap.set(nodeData.id, nodeData);
  };

  //share outgoing changes
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      if (!nodesMap) return;

      // current shared state read
      const nodes = Array.from(nodesMap.values());
      // apply changes to get the next state
      const nextNodes = applyNodeChanges(changes, nodes);

      for (const change of changes) {
        if (change.type === "add" || change.type === "replace") {
          // add or replace items for new or updated nodes
          nodesMap.set(change.item.id, change.item);
        } else if (change.type === "remove" && nodesMap.has(change.id)) {
          // or remove them if a node was deleted
          nodesMap.delete(change.id);
        } else {
          nodesMap.set(change.id, nextNodes.find((n) => n.id === change.id)!);
        }
      }
    },
    [nodesMap],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      if (!edgesMap) return;
      const edges = Array.from(edgesMap.values());
      const nextEdges = applyEdgeChanges(changes, edges);

      for (const change of changes) {
        if (change.type === "add" || change.type === "replace") {
          edgesMap.set(change.item.id, change.item);
        } else if (change.type === "remove" && edgesMap.has(change.id)) {
          edgesMap.delete(change.id);
        } else {
          edgesMap.set(change.id, nextEdges.find((n) => n.id === change.id)!);
        }
      }
    },
    [edgesMap],
  );

  // trigger for reactflow whenever the user creates a new connection between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (!edgesMap) return;
      
      const edges = Array.from(edgesMap.values());
      // generate a new edge and store it the shared state
      const nextEdges = addEdge(params, edges);

      //store it in the shared state if its not already there
      for (const edge of nextEdges) {
        if (edgesMap.has(edge.id)) {
          continue;
        }

        edgesMap.set(edge.id, edge);
      }
    },
    [edgesMap],
  );

  // Send awareness updates to other users
  // this function is attached to on mouse move and on mouse drag
  const updateAwareness = useCallback(
    //takes the mouse event and call provider.setAwarenessField
    (e: MouseEvent) => {
      if (!provider) {
        return;
      }

      // Converting screen coordinates to flow position

      // THE COORD TRAP
      // because users can zoom and pan we cannot sed raw screen pixels;
      // if we did that my cursor would be in the wrong place for someone who panned their view
      // (1)therefore we need a helper to translate my screen pixels into the abosulte coord of the diagram
      const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // pass users metadata
      provider.setAwarenessField("userMetadata", {
        userName,
        cursorPosition: flowPosition,
      });
    },
    [provider, screenToFlowPosition, userName],
  );

  // Receiving awareness updates
  // to see other users we use useeffect that subscribes  to the update event on the awareness object
  useEffect(() => {
    if (!provider?.awareness) return;

    const awarenessObserver = () => {
      //inside this listener we get a list of all states
      const states = provider.awareness?.getStates();

      if (!states) return;

      const updatedAwareness: AwarenessUserData[] = [];

      //we iterate through them but we must filter out our own client ID otherwise we would see a ghost cursor following ours with network delay
      for (const [clientId, state] of states.entries()) {
        const userMetadata: AwarenessUserData | undefined = state.userMetadata;

        // Do not track this client's cursor
        if (clientId === provider.awareness?.clientID || !userMetadata)
          continue;

        // the remaining states are mapped to our local React state...
        updatedAwareness.push({
          userName: userMetadata.userName,
          // Converting flow position to screen coordinates

          //(2) when recieving someone elses position ; this takes their absolute coords and projects them onto my current screen viewport
          cursorPosition: flowToScreenPosition(userMetadata.cursorPosition),
        });
      }
      //...which we the render as cursors components
      setAwareness(updatedAwareness);
    };

    provider.awareness.on("update", awarenessObserver);

    return () => {
      provider.awareness?.off("update", awarenessObserver);
    };
  }, [provider, flowToScreenPosition]);

  return (
    <>
      <div className="diagram-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onMouseMove={updateAwareness}
          onNodeDrag={updateAwareness}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>

        <button className="add-node-btn" onClick={addNode}>
          Add node
        </button>
      </div>
      {awareness.map(({ cursorPosition, userName }, index) => (
        <Cursor
          key={index}
          cursorPosition={cursorPosition}
          userName={userName}
        />
      ))}
    </>
  );
};

//====== Awareness ======//
// the mechanism for sharing ephemeral state like user presence, cursor position, or selection across clients
// ... data that doesn't need to be saved in the document history
// one of the uses is real-time user cursors.
