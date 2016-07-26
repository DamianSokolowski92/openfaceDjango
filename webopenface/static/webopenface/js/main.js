navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

$.fn.exists = function(){return this.length != 0}

var defaultPerson = null;
var vid = document.getElementById('videoel'),
    vidReady = false;
var people = {}, defaultPerson = -1,
    images = [];

function getDataURLFromRGB(rgb) {
    var rgbLen = rgb.length;

    var canvas = $('<canvas/>').width(96).height(96)[0];
    var ctx = canvas.getContext("2d");
    var imageData = ctx.createImageData(96, 96);
    var data = imageData.data;
    var dLen = data.length;
    var i = 0, t = 0;

    for (; i < dLen; i +=4) {
        data[i] = rgb[t+2];
        data[i+1] = rgb[t+1];
        data[i+2] = rgb[t];
        data[i+3] = 255;
        t += 3;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL("image/png");
}

function sendFrameLoop() {
    if (vidReady) {
        var canvas = document.createElement('canvas');
        canvas.width = vid.width;
        canvas.height = vid.height;
        var cc = canvas.getContext('2d');
        cc.drawImage(vid, 0, 0, vid.width, vid.height);
        var dataURL = canvas.toDataURL('image/jpeg', 0.6);
        $.ajax({
            url: "/openface/api/onmessage/",
            type : "POST",
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            data: JSON.stringify({
                type: 'FRAME',
                dataURL: dataURL,
                training: $("#trainingChk").prop('checked'),
                identity: defaultPerson,
            }),

            success: function (json) {
				if (typeof personSite !== 'undefined' && !$("#trainingChk").prop('checked')) {
					return;
				}

                if(json['ANNOTATED']){
                    $("#detectedFaces").html(
                        "<img src='" + json['ANNOTATED']['content'] + "' width='430px'>"
                    )
                }

                if (json['NEW_IMAGE']) {
                    var j = json['NEW_IMAGE']
                    images.push({
                        hash: j.hash,
                        identity: j.identity,
                        image: j.content,//getDataURLFromRGB(j.content),
                        representation: j.representation
                    });
                    $("#detectedFaces").html(
                        "<img src='" + j.content + "' width='430px'>"
                    )
                }

                if (json['IDENTITIES']) {
                    var identities = json["IDENTITIES"]['identities'];
                    var list = $("<ul></ul>");
                    var detected_people = $('#detectedPeople div');
                    detected_people.html("Last updated: " + (new Date()).toTimeString());
                    if (identities.length > 0) {
                        $.each(identities, function(index, value){
                            list.append("<li>"+((value != -1) ? people[value] : "Unknown")+"</li>")
                        });
                        detected_people.append(list)
                    } else {
                        detected_people.append("Nobody detected.");
                    }
                }
                getPeopleInfoHtml()
				sendFrameLoop();
            },

            error: function (xhr, errmsg, err) {
                console.log('error FRAME');
                sendFrameLoop();
            }
        });
    }
}

function getPeopleInfoHtml() {
    var info = {'-1': 0};
    $.each(people, function(index, value) {
        info[index] = 0;
    });
    var len = images.length;
    for (var i = 0; i < len; i++) {
        info[images[i].identity] += 1;
    }

    var valueMax = $('#progress_bar div').attr('aria-valuemax')
    $('#progress_bar div').width((info[defaultPerson]/valueMax*100)+'%');
    $('#progress_bar span').text(info[defaultPerson]+'/'+valueMax);

    var list = $("<ul></ul>");
    $.each(people, function(index, value){
        list.append("<li><b>"+people[index]+":</b> "+info[index]+"</li>")
    });

    $('#peopleInfo').html(list)
    if (info[defaultPerson] >= valueMax && $("#trainingChk").prop('checked')) {
        $("#trainingChk").bootstrapToggle('off');
        $('#addPersonTxt').prop('readonly', false).val("");
        $('#addPersonBtn').prop('disabled', false);
        $.ajax({
            url: "/openface/api/onmessage/",
            type : "POST",
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            data: JSON.stringify({type: 'TRAIN_SVM'}),
            success: function (json) {
                console.log('TRAIN_SVM');
            },
            error: function (json) {
            }
        });
    }
}

function camSuccess(stream){
    vid.src = (window.URL.createObjectURL(stream)) || stream;
    vid.play();
    vidReady = true;
    sendFrameLoop();
}

//function trainingChkCallback() {
//    sendFrameLoop();
//    //$.ajax({
//    //    url : "/openface/api/onmessage/",
//    //    type : "POST",
//    //    data : {
//		//	type: 'TRAINING',
//		//	val: $("#trainingChk").prop('checked')
//		//},
//    //
//    //    success : function(json) {
//    //        console.log('trai');
//    //        console.log($("#trainingChk").prop('checked'));
//		//	sendFrameLoop();
//    //    },
//    //
//    //    error : function(xhr,errmsg,err) {
//		//	console.log('error training');
//    //    }
//    //});
//}

function addPerson(){
    //console.log('click');
    var newPerson = $("#addPersonTxt").val();
    if (newPerson != '') {
        $.ajax({
            url: "/openface/api/onmessage/",
            type: "POST",
            contentType: "application/json; charset=utf-8",
            dataType: 'json',
            data: JSON.stringify({
                type: 'ADD_PERSON',
                val: newPerson
            }),

            success: function (json) {
                //console.log('yea');
                defaultPerson = null;
                if (json.hasOwnProperty('id')) {
                    $('#addPersonTxt').prop('readonly', true);
                    $('#addPersonBtn').prop('disabled', true);
                    $("#trainingChk").bootstrapToggle('on')
                            console.log(json['id']);
                    defaultPerson = json['id'];
                    people[defaultPerson] = newPerson;;

                    if (typeof personSite !== 'undefined') {
                        trainingChkCallback()
                        console.log('personSite');
                    }
                }
            },

            error: function (xhr, errmsg, err) {
                console.log('error add_person');
            }
        });
    }
}

$(document).ready(function(){
    if ( !$('#previewPage').exists()) {
        if (navigator.getUserMedia) {
            navigator.getUserMedia({video: true}, camSuccess,
                function () {
                    alert('Błąd przechwytywania obrazu z kamery');
                }
            )
        } else {
            alert('Nie wykryto kamery');
        }
    }

	$("#addPersonBtn").click(addPerson);
    //$("#trainingChk").change(trainingChkCallback);
});