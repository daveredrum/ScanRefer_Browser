import * as THREE from 'three/build/three';

window.THREE = THREE;


exports.project_point_onto_plane = function(point, normal, planar_point){
	/*
		Returns a new THREE.Vector3 that is a projection of point 
			into the plane defined by normal and planar_point (point-normal form)
	*/
    let delta = normal.clone();
    delta.multiplyScalar(normal.dot(planar_point.clone().sub(point)));
    return point.clone().add(delta)
}

exports.point_to_plane_distance = function(point, normal, planar_point){
    return Math.abs(normal.dot(planar_point.clone().sub(point)));
}

exports.rotation_matrix_aligning_two_vectors = function(v1, v2){
    /*
        Returns SE(3) matrix, with no translation component, that can be used:
        	v1.applyMatrix4(M) to transform v1 to be collinear with v2
    */
    // Find axis of rotation
    let axis = (new THREE.Vector3()).crossVectors(v1, v2).normalize();

    // Find angle between vectors
    let angle = Math.acos(v1.dot(v2) / 
                         (v1.distanceTo(new THREE.Vector3()) * v2.distanceTo(new THREE.Vector3())));

    // Build model matrix for new plane
    return (new THREE.Matrix4()).makeRotationAxis(axis, angle);
}
