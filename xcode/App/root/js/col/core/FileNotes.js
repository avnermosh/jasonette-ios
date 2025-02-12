'use strict';

import { COL } from '../COL.js'
import { Model } from "./Model.js";
import { BlobInfo } from "./BlobInfo.js";
import { FileZip_withJson } from "../loaders/FileZip_withJson.js";

COL.core.FileNotes = {
};

(function () {

    var _this = this;

    this.loadNotesFromJsonFile = async function (layer, notesFilename) {
        
        let selectedLayer = COL.model.getSelectedLayer();
        let metaDataFilesInfo = selectedLayer.getMetaDataFilesInfo();
        let metaDataFileInfo = metaDataFilesInfo.getByKey(notesFilename);
        let blobInfo = metaDataFileInfo.blobInfo;
        
        let notesArray1 = await FileZip_withJson.loadFile_viaFetch(blobInfo, "json");

        let stickyNoteGroup = layer.getStickyNoteGroup();
        let texturePlugin = layer.getTexturePanelPlugin()
        var texScene = texturePlugin.getTexScene();
        var texCamera = texturePlugin.getTexCamera();
        var texLabelRenderer = texturePlugin.getTexLabelRenderer();

        var noteArray = layer.getNoteArray();
        
        for (var index = 0; index < notesArray1.length; index++) {

            let note = notesArray1[index];
            let noteData = notesArray1[index].data;
            let noteStyle = notesArray1[index].style;
            let imageFilename = notesArray1[index].imageFilename;
            
            let noteId = "note" + Number(index);

            let newNote = new Note(noteId,
                                   noteData,
                                   noteStyle,
                                   imageFilename,
                                   index,
                                   layer,
                                   texLabelRenderer,
                                   texScene,
                                   texCamera);

            noteArray.set(noteId, newNote);
        }

        texScene.add( stickyNoteGroup );
        
        layer.setNoteArray(noteArray);
        
    };

    this.exportNotesToBlob = function(layer, metaDataFilesInfo, notesFilename) {

        var noteArray = layer.getNoteArray();

        let notesExported = [];

        let iter = noteArray.iterator();
        while (iter.hasNext()) {
            let note = iter.next();
            
            let myDelta = note.getQuill().getContents();
            let notesDataExported = JSON.stringify(myDelta);
            
            let notes_style = {top: note.getStyle().top,
                               left: note.getStyle().left};

            let noteExported = {data: notesDataExported,
                                style: notes_style,
                                imageFilename: note.getImageFilename()};

            notesExported.push(noteExported);
        }
        
        let notesExported2 = JSON.stringify(notesExported);
        var notesExportedBlob = new Blob([notesExported2], {type: 'application/json'});

        let blobInfo = new BlobInfo({filenameFullPath: notesFilename, blobUrl: undefined, isDirty: true});
        blobInfo.blobUrl = URL.createObjectURL(notesExportedBlob);

        let metaDataFileInfo = metaDataFilesInfo.getByKey(notesFilename);
        if(COL.util.isObjectInvalid(metaDataFileInfo))
        {
            metaDataFileInfo = new ImageInfo({filename: notesFilename, blobInfo: blobInfo});
        }
        
        metaDataFilesInfo.set(notesFilename, metaDataFileInfo);
    };

    
}).call(COL.core.FileNotes);
