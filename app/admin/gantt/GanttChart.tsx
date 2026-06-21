"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  GanttComponent,
  Inject,
  Edit,
  Selection,
  Toolbar,
  DayMarkers,
  ColumnsDirective,
  ColumnDirective,
  EditSettingsModel,
  ToolbarItem,
} from "@syncfusion/ej2-react-gantt";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  writeBatch,
  doc,
  deleteDoc,
  setDoc,
  updateDoc,
  getDocs,
} from "firebase/firestore";
import { Button, Box, CircularProgress, Typography, Stack } from "@mui/material";
import {
  CloudUpload as UploadIcon,
  CloudDownload as DownloadIcon,
  Add as AddIcon,
  PlayArrow as SeedIcon,
} from "@mui/icons-material";

// Import styles
import "@syncfusion/ej2-base/styles/material.css";
import "@syncfusion/ej2-buttons/styles/material.css";
import "@syncfusion/ej2-calendars/styles/material.css";
import "@syncfusion/ej2-dropdowns/styles/material.css";
import "@syncfusion/ej2-inputs/styles/material.css";
import "@syncfusion/ej2-navigations/styles/material.css";
import "@syncfusion/ej2-lists/styles/material.css";
import "@syncfusion/ej2-layouts/styles/material.css";
import "@syncfusion/ej2-popups/styles/material.css";
import "@syncfusion/ej2-grids/styles/material.css";
import "@syncfusion/ej2-treegrid/styles/material.css";
import "@syncfusion/ej2-react-gantt/styles/material.css";

const seedData = [
  {
    TaskID: 1,
    TaskName: "Project Initiation",
    StartDate: "2026-06-01",
    Duration: 5,
    Progress: 80,
    ParentID: null,
    ProjectID: "proj-1",
  },
  {
    TaskID: 2,
    TaskName: "Identify Site Location",
    StartDate: "2026-06-01",
    Duration: 4,
    Progress: 80,
    ParentID: 1,
    ProjectID: "proj-1",
  },
  {
    TaskID: 3,
    TaskName: "Perform Valuation",
    StartDate: "2026-06-02",
    Duration: 3,
    Progress: 60,
    Predecessor: "2FS",
    ParentID: 1,
    ProjectID: "proj-1",
  },
  {
    TaskID: 4,
    TaskName: "Feasibility Study",
    StartDate: "2026-06-04",
    Duration: 4,
    Progress: 30,
    Predecessor: "3FS",
    ParentID: 1,
    ProjectID: "proj-1",
  },
  {
    TaskID: 5,
    TaskName: "Project Planning",
    StartDate: "2026-06-09",
    Duration: 11,
    Progress: 40,
    ParentID: null,
    ProjectID: "proj-1",
  },
  {
    TaskID: 6,
    TaskName: "Define Resources",
    StartDate: "2026-06-09",
    Duration: 3,
    Progress: 40,
    Predecessor: "4FS",
    ParentID: 5,
    ProjectID: "proj-1",
  },
  {
    TaskID: 7,
    TaskName: "Establish Budget",
    StartDate: "2026-06-11",
    Duration: 4,
    Progress: 20,
    Predecessor: "6FS",
    ParentID: 5,
    ProjectID: "proj-1",
  },
  {
    TaskID: 8,
    TaskName: "Procurement",
    StartDate: "2026-06-15",
    Duration: 5,
    Progress: 0,
    Predecessor: "7FS",
    ParentID: 5,
    ProjectID: "proj-1",
  },
];

// Helper function to build nested hierarchy (Tree) from flat array
function arrayToTree(flatList: any[]) {
  const map: { [key: number]: any } = {};
  const tree: any[] = [];

  flatList.forEach((item) => {
    map[item.TaskID] = { ...item, subtasks: [] };
  });

  flatList.forEach((item) => {
    const mappedItem = map[item.TaskID];
    if (item.ParentID !== null && item.ParentID !== undefined && map[item.ParentID]) {
      map[item.ParentID].subtasks.push(mappedItem);
    } else {
      tree.push(mappedItem);
    }
  });

  return tree;
}

export default function GanttChart({ projectId = "proj-1" }: { projectId?: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time changes in Firestore gantt_tasks collection
  useEffect(() => {
    const q = query(collection(db, "gantt_tasks"), where("ProjectID", "==", projectId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedTasks: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedTasks.push({
            ...data,
            // Convert string date from Firestore back to JS Date object
            StartDate: data.StartDate ? new Date(data.StartDate) : null,
            EndDate: data.EndDate ? new Date(data.EndDate) : null,
            firestoreDocId: docSnap.id,
          });
        });
        // Sort by TaskID to maintain order
        loadedTasks.sort((a, b) => a.TaskID - b.TaskID);
        setTasks(loadedTasks);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching Firestore gantt tasks:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  // Fetch users from Firestore and map them to numeric resourceIds for Syncfusion
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list: any[] = [];
        let index = 1;
        snap.forEach((d) => {
          list.push({
            resourceId: index++, // Syncfusion requires numeric IDs
            resourceName: d.data().name || (d.data().firstName ? `${d.data().firstName} ${d.data().lastName || ""}`.trim() : "User"),
            uid: d.id, // original string UID from Firestore
          });
        });
        setResources(list);
      } catch (err) {
        console.error("Error fetching users for resources:", err);
      } finally {
        setResourcesLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Map tasks to use numeric resource IDs for Syncfusion Gantt component
  const mappedTasksForGantt = useMemo(() => {
    if (resources.length === 0 || tasks.length === 0) return [];
    return tasks.map(task => {
      const assigneeItems = Array.isArray(task.Assignees) ? task.Assignees : [];
      const numericIds = assigneeItems
        .map((item: any) => {
          if (typeof item === "object" && item !== null) {
            // It could be an object saved in Firestore
            const uid = item.uid;
            if (uid) {
              const found = resources.find(r => r.uid === uid);
              return found ? found.resourceId : null;
            }
            const resId = item.resourceId || item.id;
            if (resId !== undefined && resId !== null) {
              const found = resources.find(r => r.resourceId === Number(resId));
              return found ? found.resourceId : null;
            }
            return null;
          }
          // It could be a simple UID string or a numeric resourceId
          const found = resources.find(r => r.uid === String(item) || r.resourceId === Number(item));
          return found ? found.resourceId : null;
        })
        .filter((val): val is number => val !== null);

      return {
        ...task,
        Assignees: numericIds
      };
    });
  }, [tasks, resources]);

  // Function to seed Firestore with demo Gantt data
  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      seedData.forEach((task) => {
        const docRef = doc(db, "gantt_tasks", `${projectId}_task_${task.TaskID}`);
        batch.set(docRef, {
          ...task,
          ProjectID: projectId,
          Assignees: []
        });
      });
      await batch.commit();
      console.log("Database seeded successfully!");
    } catch (error) {
      console.error("Error seeding database:", error);
    } finally {
      setSeeding(false);
    }
  };

  // Add First Task
  const handleAddFirstTask = async () => {
    try {
      const docRef = doc(db, "gantt_tasks", `${projectId}_task_1`);
      await setDoc(docRef, {
        TaskID: 1,
        TaskName: "Add First Task",
        StartDate: new Date().toISOString().split("T")[0],
        Duration: 1,
        Progress: 0,
        ParentID: null,
        ProjectID: projectId,
        Predecessor: null,
        Assignees: [],
      });
      console.log("First task added successfully!");
    } catch (error) {
      console.error("Error adding first task:", error);
    }
  };

  // Export current tasks to JSON file
  const handleExportJSON = () => {
    const exportData = tasks.map(t => ({
      TaskID: t.TaskID,
      TaskName: t.TaskName,
      StartDate: t.StartDate instanceof Date ? t.StartDate.toISOString().split("T")[0] : t.StartDate,
      Duration: t.Duration,
      Progress: t.Progress,
      ParentID: t.ParentID,
      ProjectID: t.ProjectID,
      Predecessor: t.Predecessor || null,
      Assignees: t.Assignees || [],
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gantt_tasks_${projectId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download template JSON file
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        TaskID: 1,
        TaskName: "Example Parent Task",
        StartDate: "2026-06-01",
        Duration: 5,
        Progress: 50,
        ParentID: null,
        ProjectID: projectId,
        Predecessor: null,
        Assignees: [],
      },
      {
        TaskID: 2,
        TaskName: "Example Subtask",
        StartDate: "2026-06-01",
        Duration: 3,
        Progress: 100,
        ParentID: 1,
        ProjectID: projectId,
        Predecessor: null,
        Assignees: [],
      }
    ];

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gantt_import_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Trigger file upload click
  const triggerImportFile = () => {
    fileInputRef.current?.click();
  };

  // Import JSON file and write to Firestore
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        const list = Array.isArray(parsed) ? parsed : [parsed];

        const batch = writeBatch(db);
        list.forEach((item: any) => {
          if (!item.TaskID) return;
          const docRef = doc(db, "gantt_tasks", `${projectId}_task_${item.TaskID}`);
          batch.set(docRef, {
            TaskID: Number(item.TaskID),
            TaskName: item.TaskName || "Imported Task",
            StartDate: item.StartDate || new Date().toISOString().split("T")[0],
            Duration: Number(item.Duration) || 1,
            Progress: Number(item.Progress) || 0,
            ParentID: item.ParentID ? Number(item.ParentID) : null,
            ProjectID: projectId,
            Predecessor: item.Predecessor || null,
            Assignees: Array.isArray(item.Assignees) ? item.Assignees : [],
          });
        });

        await batch.commit();
        alert("Imported successfully!");
      } catch (err) {
        alert("Failed to parse JSON file or save to database. Please check the file format.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = ""; // Reset file input
  };

  // Sync edits, additions, and deletions from Gantt component back to Firestore
  const handleActionComplete = async (args: any) => {
    console.log("Gantt Action Complete:", args.requestType, args);

    // Update task
    if (args.requestType === "save" && args.data) {
      const taskData = Array.isArray(args.data) ? args.data[0] : args.data;
      if (taskData) {
        const docRef = doc(db, "gantt_tasks", `${projectId}_task_${taskData.TaskID}`);
        
        // Extract assigned resource IDs
        let assignedResourceIds: any[] = [];
        if (taskData.ganttProperties && Array.isArray(taskData.ganttProperties.resourceInfo)) {
          assignedResourceIds = taskData.ganttProperties.resourceInfo;
        } else if (Array.isArray(taskData.Assignees)) {
          assignedResourceIds = taskData.Assignees;
        }

        // Map numeric resourceIds back to Firestore UIDs
        const uidsToSave = assignedResourceIds.map(res => {
          if (typeof res === "object" && res !== null) {
            if (res.uid) return String(res.uid);
            const id = res.resourceId || res.id;
            if (id !== undefined && id !== null) {
              const found = resources.find(r => r.resourceId === Number(id));
              return found ? found.uid : String(id);
            }
            return null;
          }
          const found = resources.find(r => r.resourceId === Number(res) || r.uid === String(res));
          return found ? found.uid : String(res);
        }).filter(Boolean);

        console.log("Saving task update. UIDs to save:", uidsToSave);

        try {
          await updateDoc(docRef, {
            TaskName: taskData.TaskName,
            StartDate: taskData.StartDate instanceof Date ? taskData.StartDate.toISOString().split("T")[0] : taskData.StartDate,
            Duration: taskData.Duration,
            Progress: taskData.Progress,
            Predecessor: taskData.Predecessor || null,
            Assignees: uidsToSave,
          });
          console.log(`Task ${taskData.TaskID} updated in Firestore`);
        } catch (err) {
          console.error("Failed to update task in Firestore:", err);
        }
      }
    }
    // Delete task
    else if (args.requestType === "delete" && args.data) {
      const tasksToDelete = Array.isArray(args.data) ? args.data : [args.data];
      for (const t of tasksToDelete) {
        const docRef = doc(db, "gantt_tasks", `${projectId}_task_${t.TaskID}`);
        try {
          await deleteDoc(docRef);
          console.log(`Task ${t.TaskID} deleted from Firestore`);
        } catch (err) {
          console.error("Failed to delete task from Firestore:", err);
        }
      }
    }
    // Add task
    else if (args.requestType === "add" && args.data) {
      const taskData = args.data;
      const docRef = doc(db, "gantt_tasks", `${projectId}_task_${taskData.TaskID}`);
      
      let assignedResourceIds: any[] = [];
      if (taskData.ganttProperties && Array.isArray(taskData.ganttProperties.resourceInfo)) {
        assignedResourceIds = taskData.ganttProperties.resourceInfo;
      } else if (Array.isArray(taskData.Assignees)) {
        assignedResourceIds = taskData.Assignees;
      }

      const uidsToSave = assignedResourceIds.map(res => {
        if (typeof res === "object" && res !== null) {
          if (res.uid) return String(res.uid);
          const id = res.resourceId || res.id;
          if (id !== undefined && id !== null) {
            const found = resources.find(r => r.resourceId === Number(id));
            return found ? found.uid : String(id);
          }
          return null;
        }
        const found = resources.find(r => r.resourceId === Number(res) || r.uid === String(res));
        return found ? found.uid : String(res);
      }).filter(Boolean);

      try {
        await setDoc(docRef, {
          TaskID: taskData.TaskID,
          TaskName: taskData.TaskName || "New Task",
          StartDate: taskData.StartDate instanceof Date ? taskData.StartDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          Duration: taskData.Duration || 1,
          Progress: taskData.Progress || 0,
          ParentID: taskData.ParentID || null,
          ProjectID: projectId,
          Predecessor: taskData.Predecessor || null,
          Assignees: uidsToSave,
        });
        console.log(`Task ${taskData.TaskID} added to Firestore`);
      } catch (err) {
        console.error("Failed to add task to Firestore:", err);
      }
    }
  };

  const taskFields = {
    id: "TaskID",
    name: "TaskName",
    startDate: "StartDate",
    endDate: "EndDate",
    duration: "Duration",
    progress: "Progress",
    dependency: "Predecessor",
    child: "subtasks",
    resourceInfo: "Assignees", // Map Syncfusion resources to the Assignees field in row data
  };

  const resourceFields = {
    id: "resourceId",
    name: "resourceName",
  };

  const editSettings: EditSettingsModel = {
    allowEditing: true,
    allowAdding: true,
    allowDeleting: true,
    allowTaskbarEditing: true,
    mode: "Auto",
  };

  const toolbarOptions: ToolbarItem[] = [
    "Add",
    "Edit",
    "Update",
    "Cancel",
    "Delete",
    "ExpandAll",
    "CollapseAll",
  ];

  if (loading || resourcesLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "400px", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading Gantt data from Firestore...
        </Typography>
      </Box>
    );
  }



  // Custom column cell template to map Assignees array (Uids) to resourceName strings and add hover tooltip
  const resourceTemplate = (props: Record<string, unknown>) => {
    console.log("resourceTemplate called with props:", props);
    // 1. Try Syncfusion's resolved resourceNames first
    const ganttProps = props.ganttProperties as Record<string, unknown> | undefined;
    const resolvedNames = ganttProps?.resourceNames as string | undefined;
    if (resolvedNames) {
      console.log("Found resolvedNames in ganttProperties:", resolvedNames);
      return (
        <span title={resolvedNames} style={{ color: "#212529", cursor: "pointer", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {resolvedNames}
        </span>
      );
    }

    // 2. Fallback to manual mapping using local resource map
    const rawAssignees = props.Assignees || ganttProps?.resourceInfo || [];
    console.log("assigneeIds for mapping:", rawAssignees);
    let assigneeIds: unknown[] = [];
    if (typeof rawAssignees === "string") {
      assigneeIds = rawAssignees.split(",").map((s: string) => s.trim());
    } else if (!Array.isArray(rawAssignees)) {
      assigneeIds = [rawAssignees];
    } else {
      assigneeIds = rawAssignees;
    }
    
    const names = assigneeIds
      .map((id: unknown) => {
        // ID could be numeric resourceId, an object, or UID string
        if (typeof id === "object" && id !== null) {
          const idObj = id as Record<string, unknown>;
          const targetId = idObj.resourceId || idObj.id || idObj.uid || id;
          const found = resources.find((r) => r.resourceId === Number(targetId) || r.uid === String(targetId));
          return found ? (found.resourceName as string) : String(targetId);
        }
        const found = resources.find((r) => r.resourceId === Number(id) || r.uid === String(id));
        return found ? (found.resourceName as string) : String(id);
      })
      .filter(Boolean)
      .join(", ");
    
    console.log("Mapped names:", names);
    return (
      <span title={names || "No assignees"} style={{ color: "#212529", cursor: "pointer", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {names || "-"}
      </span>
    );
  };

  const dialogFields: any = [
    { type: "General", headerText: "General" },
    { type: "Dependency" },
    { type: "Resources" }
  ];

  if (tasks.length === 0) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "400px", gap: 3, p: 4 }}>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={handleImportJSON}
          style={{ display: "none" }}
        />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          No Gantt Tasks Found in Firestore
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 450, mb: 1 }}>
          It looks like the `gantt_tasks` collection is currently empty for this project. Start by adding your first task, seeding demo data, or importing from a JSON file.
        </Typography>

        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", justifyContent: "center", gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddFirstTask}
            sx={{ borderRadius: 2 }}
          >
            Add First Task
          </Button>
          <Button
            variant="outlined"
            startIcon={<SeedIcon />}
            onClick={handleSeedData}
            disabled={seeding}
            sx={{ borderRadius: 2 }}
          >
            Seed Demo Data
          </Button>
          <Button
            variant="outlined"
            color="success"
            startIcon={<UploadIcon />}
            onClick={triggerImportFile}
            sx={{ borderRadius: 2 }}
          >
            Import JSON
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            sx={{ borderRadius: 2 }}
          >
            Get Template
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <div className="control-section" style={{ width: "100%", background: "#ffffff" }}>
      <style>{`
        .e-gantt .e-rowcell, 
        .e-gantt .e-rowcell span,
        .e-gantt .e-headercell,
        .e-gantt .e-headercell-value,
        .e-gantt .e-treecell,
        .e-gantt .e-treecell span {
          color: #212529 !important;
        }
      `}</style>
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        onChange={handleImportJSON}
        style={{ display: "none" }}
      />
      
      {/* Top action bar for import/export */}
      <Stack direction="row" spacing={2} sx={{ m: 2, justifyContent: "flex-end" }}>
        <Button
          variant="outlined"
          color="success"
          size="small"
          startIcon={<UploadIcon />}
          onClick={triggerImportFile}
          sx={{ borderRadius: 1.5 }}
        >
          Import JSON
        </Button>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleExportJSON}
          sx={{ borderRadius: 1.5 }}
        >
          Export JSON
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          sx={{ borderRadius: 1.5 }}
        >
          Get Template
        </Button>
      </Stack>

      <div style={{ height: "600px", width: "100%" }}>
        <GanttComponent
          dataSource={arrayToTree(mappedTasksForGantt)}
          taskFields={taskFields}
          splitterSettings={{ position: "515px" }}
          editSettings={editSettings}
          toolbar={toolbarOptions}
          height="100%"
          allowSelection={true}
          highlightWeekends={true}
          treeColumnIndex={1}
          actionComplete={handleActionComplete}
          resources={resources}
          resourceFields={resourceFields}
          addDialogFields={dialogFields}
          editDialogFields={dialogFields}
        >
          <ColumnsDirective>
            <ColumnDirective field="TaskID" width="80" textAlign="Right"></ColumnDirective>
            <ColumnDirective field="TaskName" width="200"></ColumnDirective>
            {/* <ColumnDirective field="StartDate" width="120" format="yMd"></ColumnDirective> */}
            <ColumnDirective field="Duration" width="80" textAlign="Right"></ColumnDirective>
            {/* <ColumnDirective field="Progress" width="80" textAlign="Right"></ColumnDirective> */}
            {/* <ColumnDirective field="Predecessor" width="100"></ColumnDirective> */}
            <ColumnDirective field="Assignees" headerText="Assignees" width="150" ></ColumnDirective>
          </ColumnsDirective>
          <Inject services={[Edit, Selection, Toolbar, DayMarkers]} />
        </GanttComponent>
      </div>
    </div>
  );
}
