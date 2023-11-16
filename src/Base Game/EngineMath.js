// variety of math tools and helpers
// ### LERP
import * as THREE from 'three';
export const lerp = function (a, b, t) {
	return a + (b - a) * t;
}

// ### ELASTIC LERP
export const elasticLerp = function (a, b, t) {
	t = Math.min(Math.max(t, 0), 0.25);
	t = (Math.sin(t * Math.PI * (0.2 + 2.5 * t * t * t)) * Math.pow(1 - t, 0.2) + t) * (1 + (0.1 * (1 - t)));
	return a + (b - a) * t;
}

// RANDOM BANK
const bankLength = 10000;
const randomBank = [];
for (let i = 0; i < bankLength; i++) {
	randomBank.push(Math.random());
}
var bankIterator = 0;
export const rapidFloat = () => { return randomBank[bankIterator++ % bankLength]; }

// ### VECTOR MOVETOWARDS
export const moveTowards = function (vectorA, vectorB, step) {
	const difference = vectorB.clone().sub(vectorA);
	if (difference.length() < step) {
		return vectorB;
	}
	return vectorA.clone().add(difference.normalize().multiplyScalar(step));
}

// ### CLAMP
export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

// ### DEBUG SPHERE
export const createVizSphere = function (position, scene, size=2) {
	const sphere = new THREE.Mesh(
		new THREE.SphereGeometry(size,2,2),
		new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff * rapidFloat()), transparent: true, opacity: 0.5 })
	);
	sphere.position.copy(position);
	sphere.rotation.setFromVector3(new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(Math.PI * 2));
	scene.add(sphere);
}