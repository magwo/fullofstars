

// Fake frame requester helper used for testing and fitness simulations
var createFrameRequester = function(timeStep) {
    var currentCb = null;
    var requester = {};
    requester.currentT = 0.0;
    requester.register = function(cb) { currentCb = cb; };
    requester.trigger = function() { requester.currentT += timeStep; if(currentCb !== null) { currentCb(requester.currentT); } };
    return requester;
};


var GRAVITATIONAL_CONSTANT = 6.673e-11;
newtonianGravityForce = function(body1Mass, body2Mass, distance) {
    // TODO: Write a test for this
    // TODO: Could add faster version for when you already have squared distance
    // Verified correct by manual tests
    var force = GRAVITATIONAL_CONSTANT * ((body1Mass*body2Mass) / (distance*distance));
    return force;
}
speedNeededForCircularOrbit = function(ourMass, otherBodyMass, distance) {
    // TODO: Write a test for this
    // Verified correct by manual tests
    var requiredSpeed = Math.sqrt( (GRAVITATIONAL_CONSTANT*(otherBodyMass+ourMass)) / distance );
    return requiredSpeed;
}