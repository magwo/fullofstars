window.fullofstars = window.fullofstars || {};

function PointMassBody(mass, position, velocity) {
    this.mass = mass;
    this.invMass = 1.0 / mass;
    this.position = position;
    this.velocity = velocity;
    this.force = new THREE.Vector3(0,0,0);
}
PointMassBody.prototype = Object.create(Object.prototype);

var tempVec = new THREE.Vector3(0,0,0);
PointMassBody.prototype.updateAndResetForce = function(dt) {
	var accelerationFactor = this.invMass * dt;
	var force = this.force;
	var velocity = this.velocity;
	tempVec.set(force.x*accelerationFactor, force.y*accelerationFactor, force.z*accelerationFactor);
	this.velocity.add(tempVec);
	tempVec.set(velocity.x*dt, velocity.y*dt, velocity.z*dt);
	this.position.add(tempVec);
	this.force.set(0,0,0);
}


var applyBruteForceNewtonianGravity = function(celestials, dt) {
    // Apply gravitational forces to all bodies, from all celestial bodies
    var tempVec = new THREE.Vector3();
    for(var i=0, celestLen=celestials.length; i<celestLen; i++) {
        var body = celestials[i];
        var bodyMass = body.mass;
        var bodyPos = body.position;
        for(var j=i+1, len=celestials.length; j<len; j++) {
            if(i !== j) {
            	var otherBody = celestials[j];
            	//console.log("applying gravity", body, otherBody);
                var otherBodyPos = otherBody.position;
                var otherBodyMass = otherBody.mass;
                var bodyToOther = tempVec.subVectors(otherBodyPos, bodyPos);
                
                var sqrDist = bodyToOther.lengthSq();
                var force = GRAVITATIONAL_CONSTANT * ((bodyMass*otherBodyMass) / sqrDist);
                // TODO: Find a way to not normalize - we already have squared distance and a vector with the full length
                var forceOnBody = bodyToOther.setLength(force);
                body.force.add(forceOnBody);
                otherBody.force.sub(forceOnBody);
            }
        }
    }
}