import './App.css';
import React, { useEffect, useReducer } from 'react';
import { API } from 'aws-amplify';
import 'antd/dist/reset.css';
// import 'antd/dist/antd.css' not working
// found assist at https://stackoverflow.com/questions/65199198/src-index-js-module-not-found-cant-resolve-antd-dist-antd-css
import { listNotes } from './graphql/queries';
import { v4 as uuid } from 'uuid';
import { List, Input, Button } from 'antd';
import {
  onCreateNote,
  onDeleteNote,
  onUpdateNote
} from './graphql/subscriptions';
import {
  updateNote as UpdateNote,
  createNote as CreateNote,
  deleteNote as DeleteNote
} from './graphql/mutations';

const CLIENT_ID = uuid();

const initialState = {
  notes: [],
  loading: true,
  error: false,
  form: { name: '', description: '' }
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.notes, loading: false };
    case 'ADD_NOTE':
      return { ...state, notes: [action.note, ...state.notes] };
    case 'REMOVE_NOTE':
      const index = state.notes.findIndex(n => n.id === action.id);
      const newNotes = [
        ...state.notes.slice(0, index),
        ...state.notes.slice(index + 1)];
      return { ...state, notes: newNotes };
    case 'UPDATE_STATUS':
      const i = state.notes.findIndex(n => n.id === action.id);
      const notes = [...state.notes]
      if (CLIENT_ID === i.clientId) return;
      //becuase these two match in the output console there should be a return and it should break the cycle.?.?
      console.log(CLIENT_ID)
      console.log(i.clientId)
      notes[i].completed = !notes.completed
      return { ...state, notes }
    case 'RESET_FORM':
      return { ...state, form: initialState.form };
    case 'SET_INPUT':
      return { ...state, form: { ...state.form, [action.name]: action.value } };
    case 'ERROR':
      return { ...state, loading: false, error: true };
    default:
      return { ...state };
  }
};

const App = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchNotes = async () => {
    try {
      const notesData = await API.graphql({
        query: listNotes
      });
      dispatch({ type: 'SET_NOTES', notes: notesData.data.listNotes.items });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ERROR' });
    }
  };

  const createNote = async () => {
    const { form } = state //destructuring - form element out of state

    if (!form.name || !form.description) {
      return alert('please enter a name and description')
    }

    const note = { ...form, clientId: CLIENT_ID, completed: false, id: uuid() }
    dispatch({ type: 'ADD_NOTE', note });
    dispatch({ type: 'RESET_FORM' });

    try {
      await API.graphql({
        query: CreateNote,
        variables: { input: note }
      })
      console.log('successfully created note!')
    } catch (err) {
      console.error("error: ", err)
    }
  };

  const deleteNote = async ({ id }) => {
    try {
      await API.graphql({
        query: DeleteNote,
        variables: { input: { id } }
      })
      console.log('successfully deleted note!')
    } catch (err) {
      console.error(err)
    }
  };

  const updateNote = async (note) => {
    const index = state.notes.findIndex(n => n.id === note.id)
    const notes = [...state.notes]
    notes[index].completed = !note.completed
    dispatch({ type: 'SET_NOTES', notes })
    try {
      await API.graphql({
        query: UpdateNote,
        variables: { input: { id: note.id, completed: notes[index].completed } }
      })
      console.log('note successfully updated!')
    } catch (err) {
      console.error(err)
    }
  };

  const onChange = (e) => {
    dispatch({ type: 'SET_INPUT', name: e.target.name, value: e.target.value })
  }

  useEffect(() => {
    fetchNotes()
    const createSubscription = API.graphql({
      query: onCreateNote
    })
      .subscribe({
        next: noteData => {
          const note = noteData.value.data.onCreateNote
          if (CLIENT_ID === note.clientId) return
          dispatch({ type: 'ADD_NOTE', note })
        }
      })

    const deleteSubscription = API.graphql({
      query: onDeleteNote
    })
      .subscribe({
        next: noteData => {
          const noteId = noteData.value.data.onDeleteNote.id
          dispatch({ type: 'REMOVE_NOTE', id: noteId })
        }
      })

    // works to udpate to completed, then it cycles thru two updates when clicked again
    const updateSubscription = API.graphql({
      query: onUpdateNote
    })
      .subscribe({
        next: noteData => {
          console.log("subscription running")
          //updateNote runs first and 
          const noteId = noteData.value.data.onUpdateNote.id
          //cycling twice with === not cycling at all with !==
          //does not matter if return is above or below dispatch
          //const note = noteData.value.data.onUpdateNote
          //console.log(CLIENT_ID)
          //console.log(note.clientId)
          //makes more sense to put the if statement within update status... I think
          //if (CLIENT_ID === noteId.id) return       
          dispatch({ type: 'UPDATE_STATUS', id: noteId })

          //does not make sense to put in UPDATE_STATUS, although I tried
          //Does not make sense to put in UpdateNote, although I tried
        }
      })

    return () => {
      updateSubscription.unsubscribe();
      createSubscription.unsubscribe();
      deleteSubscription.unsubscribe();
    }
  }, []);

  const completed = state.notes.filter(n => n.completed).length;
  const total = state.notes.length;

  const styles = {
    container: { padding: 20 },
    input: { marginBottom: 10 },
    item: { textAlign: 'left' },
    p: { color: '#1890ff' }
  }

  function renderItem(item) {
    return (
      <List.Item
        style={styles.item}
        actions={[
          <p style={styles.p} onClick={() => deleteNote(item)}>delete</p>,
          <p style={styles.p} onClick={() => updateNote(item)}>
            {item.completed ? 'completed' : 'to do'}
          </p>
        ]}
      >
        <List.Item.Meta
          title={item.name}
          description={item.description}
        />
      </List.Item>
    )
  };

  return (
    <div style={styles.container}>

      <Input
        onChange={onChange}
        value={state.form.name}
        placeholder="Note Name"
        name='name'
        style={styles.input}
      />

      <Input
        onChange={onChange}
        value={state.form.description}
        placeholder="Note description"
        name='description'
        style={styles.input}
      />

      <Button
        onClick={createNote}
        type="primary"
      >Create Note</Button>

      <>
        <h4 style={{ color: '#2b99ff', textAlign: 'right' }}>
          {completed} completed / {total} total
        </h4>
        <hr />
      </>


      <List
        //header={<div> Number Completed: {numberCompleted} vs. Total: {listTotal}</div>} to small
        loading={state.loading}
        dataSource={state.notes}
        renderItem={renderItem}
      />

    </div>
  )
};

export default App;
