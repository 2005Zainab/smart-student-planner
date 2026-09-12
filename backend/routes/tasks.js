import express from 'express';
import { db } from '../src/firebase.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

//Try to delete task
router.delete('/:id', requireAuth, async (req, res) =>{

    const uid = req.user.uid;

    try{
        const taskDoc = db.collection("tasks").doc(req.params.id);
        const taskSnap = await taskDoc.get();

        if(!taskSnap.exists){
            return res.status(404).json({ message: "Task Wasn't Found"});
        }

        if(taskSnap.data().userId != uid){
            return res.status(403).json({error: "Unauthorized to delete this task: You do not own this task"});
        }

        await taskDoc.delete();
        res.status(200).json({ message: 'Task Deleted'});
    }catch (err){
        console.log(err);
        res.status(500).json({ error: 'Failed to Delete Task'});
    }
});

export default router;