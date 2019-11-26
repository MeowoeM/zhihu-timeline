console.log ("iframe start: " + window.location.href);
// wait for the AJAXed-in content...
waitForKeyElements ('#Profile-following', function(jNode){
    window.top.postMessage (jNode.html(), "*");
});