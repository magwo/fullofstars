(function() {

var fullofstars = window.fullofstars = window.fullofstars || {};

fullofstars.LIGHT_YEAR = 9.4607 * Math.pow(10, 15);
fullofstars.MILKY_WAY_DIAMETER = 140 * 1000 * fullofstars.LIGHT_YEAR;
fullofstars.UNIVERSE_SCALE = 1000 / fullofstars.MILKY_WAY_DIAMETER;
fullofstars.UNIVERSE_SCALE_RECIPROCAL = 1.0 / fullofstars.UNIVERSE_SCALE;
fullofstars.LIGHT_YEAR_SCALED = fullofstars.LIGHT_YEAR * fullofstars.UNIVERSE_SCALE;
fullofstars.LIGHT_SPEED = 299792458;
fullofstars.LIGHT_SPEED_SCALED = fullofstars.LIGHT_SPEED * fullofstars.UNIVERSE_SCALE;
fullofstars.LIGHT_SPEED_SCALED_SQRD = fullofstars.LIGHT_SPEED_SCALED * fullofstars.LIGHT_SPEED_SCALED;
fullofstars.GRAVITATIONAL_CONSTANT = 6.673e-11;
fullofstars.GRAVITY_EPSILON = Math.pow(10, 18);
fullofstars.TYPICAL_STAR_MASS = 2 * Math.pow(10, 30);

// Fake frame requester helper used for testing and fitness simulations
window.createFrameRequester = function(timeStep) {
    var currentCb = null;
    var requester = {};
    requester.currentT = 0.0;
    requester.register = function(cb) { currentCb = cb; };
    requester.trigger = function() { requester.currentT += timeStep; if(currentCb !== null) { currentCb(requester.currentT); } };
    return requester;
};

window.newtonianGravityForce = function(body1Mass, body2Mass, distance) {
    // TODO: Write a test for this
    // TODO: Could add faster version for when you already have squared distance
    // Verified correct by manual tests
    var force = GRAVITATIONAL_CONSTANT * ((body1Mass*body2Mass) / (distance*distance));
    return force;
}
window.speedNeededForCircularOrbit = function(ourMass, otherBodyMass, distance) {
    // TODO: Write a test for this
    // Verified correct by manual tests
    var requiredSpeed = Math.sqrt( (GRAVITATIONAL_CONSTANT*(otherBodyMass+ourMass)) / distance );
    return requiredSpeed;
}

})();
