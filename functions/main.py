# Welcome to Cloud Functions for Firebase for Python!
# Deploy with `firebase deploy`

import math
from firebase_functions import firestore_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore

# Initialize firebase admin app
initialize_app()

set_global_options(max_instances=10)

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) in meters.
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    r = 6371000 # Radius of earth in meters
    return c * r

@firestore_fn.on_document_created(document="presences/{presenceId}")
def on_presence_created(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    """
    Triggered when a new presence record is created (synced from offline or created online).
    Validates the employee coordinates against the project location.
    Saves the default cost_on_presence for the user at that project.
    Updates the presence status accordingly.
    """
    if event.data is None:
        return

    presence_data = event.data.to_dict()
    if not presence_data:
        return

    db = firestore.client()
    presence_ref = event.data.reference

    user_id = presence_data.get("user_id")
    project_id = presence_data.get("project_id")
    emp_lat = presence_data.get("latitude")
    emp_lon = presence_data.get("longitude")
    
    updates = {}

    # 1. Fetch & lock cost_on_presence from 'cost_people_on_project'
    cost = 0
    if user_id and project_id:
        try:
            # Query cost_people_on_project where project_id == project_id and user_id == user_id
            costs_ref = db.collection("cost_people_on_project")
            query = costs_ref.where("project_id", "==", project_id).where("user_id", "==", user_id).limit(1)
            docs = query.get()
            if docs:
                cost_data = docs[0].to_dict()
                cost = cost_data.get("cost", 0)
        except Exception as e:
            print(f"Error fetching cost_people_on_project: {e}")
    
    updates["cost_on_presence"] = cost

    # 2. Geofencing/Radius Validation against Project Location
    if project_id and emp_lat is not None and emp_lon is not None:
        try:
            project_ref = db.collection("projects").document(project_id)
            project_doc = project_ref.get()
            
            if project_doc.exists:
                proj_data = project_doc.to_dict() or {}
                # Location can be stored as geopoint or separate lat/lon
                # We handle both formats: geopoint object or lat/lon fields
                location = proj_data.get("location")
                proj_lat = None
                proj_lon = None
                proj_radius = proj_data.get("radius", 100) # default 100 meters

                if location:
                    if hasattr(location, "latitude") and hasattr(location, "longitude"):
                        proj_lat = location.latitude
                        proj_lon = location.longitude
                    elif isinstance(location, dict):
                        proj_lat = location.get("latitude")
                        proj_lon = location.get("longitude")
                
                # Fallback to direct field values if not in location map
                if proj_lat is None:
                    proj_lat = proj_data.get("latitude")
                if proj_lon is None:
                    proj_lon = proj_data.get("longitude")

                if proj_lat is not None and proj_lon is not None:
                    distance = haversine_distance(emp_lat, emp_lon, proj_lat, proj_lon)
                    
                    # Update radius and verify
                    updates["radius"] = distance
                    
                    # If employee is within allowed project radius, auto-approve
                    # Otherwise, keep it Pending (requiring manager approval)
                    if distance <= proj_radius:
                        updates["status"] = "Approved"
                        updates["approved_at"] = firestore.SERVER_TIMESTAMP
                        updates["approved_by"] = "system-geofence"
                        updates["approved_note"] = f"Auto-approved by System Geofencing. Distance: {round(distance, 2)}m <= {proj_radius}m"
                    else:
                        updates["status"] = "Pending"
                        updates["note"] = f"Awaiting approval. Distance: {round(distance, 2)}m > {proj_radius}m (Out of range)"
                else:
                    updates["note"] = "Project location is not properly set. Needs manual verification."
            else:
                updates["note"] = "Project not found. Needs manual verification."
        except Exception as e:
            print(f"Error validating geofencing: {e}")
            updates["note"] = f"Error during geofencing verification: {str(e)}"
    else:
        # If no project coordinates or project ID is missing, default to Pending
        updates["status"] = "Pending"
        if not project_id:
            updates["note"] = "No project specified."
        else:
            updates["note"] = "Missing GPS coordinates."

    # 3. Update the presence document in Firestore
    if updates:
        try:
            presence_ref.update(updates)
        except Exception as e:
            print(f"Error updating presence document {presence_ref.id}: {e}")