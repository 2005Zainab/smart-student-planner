import express from 'express';
import { db } from '../src/firebase.js';
import { getAuth } from 'firebase-admin/auth';

const router = express.Router();

//Try to delete task
router.delete('/:id', async (req, res) =>{

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({message: "No token was provided"})
    }

    const idToken = authHeader.split("Bearer ")[1];

    if(!idToken){
        return res.status(401).json({message: "No token was provided"});
    }

    let verifiedToken;
    try{
        verifiedToken = await getAuth().verifyIdToken(idToken);
    }catch(err){
        return res.status(401).json({message: "Token is invalid or Expired"});
    }

    const uid = verifiedToken.uid;

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