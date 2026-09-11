import express from 'express';
import { db } from '../src/firebase.js';
import { doc, deleteDoc } from "firebase/firestore";

const router = express.Router();

//Try to delete task
router.delete('/:id', async (req, res) =>{
    try{
        await deleteDoc(doc(db, "tasks", req.params.id));
        res.status(200).json({ message: 'Task Deleted'});
    }catch (err){
        console.log(err);
        res.status(500).json({ error: 'Failed to Delete Task'});
    }
});

export default router;