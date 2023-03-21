import './App.css';
import React, { useEffect, useReducer } from 'react';
import { API } from 'aws-amplify';
import 'antd/dist/reset.css';
// import 'antd/dist/antd.css' not working
// found assist at https://stackoverflow.com/questions/65199198/src-index-js-module-not-found-cant-resolve-antd-dist-antd-css
import { listNotes } from './graphql/queries';
import { v4 as uuid } from 'uuid';
import { List, Input, Button, Divider } from 'antd';
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
      console.log(err);
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
    const index = state.notes.findIndex(n => n.id === id)
    const notes = [
      ...state.notes.slice(0, index), //TODO add filter?.?
      ...state.notes.slice(index + 1)];
    dispatch({ type: 'SET_NOTES', notes })
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
    //once this is figure out see if it can be combined for less code 
    fetchNotes()
    const subscription = API.graphql({
      query: onCreateNote
    })
      .subscribe({
        next: noteData => {
          const note = noteData.value.data.onCreateNote
          if (CLIENT_ID === note.clientId) return
          dispatch({ type: 'ADD_NOTE', note })
        }
      })
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchNotes()
    const subscription = API.graphql({
      query: onDeleteNote
    })
      .subscribe({
        next: noteData => {
          const note = noteData.value.data.onDeleteNote
          if (CLIENT_ID === note.clientId) return
          // Set_note removes entire list from 2nd window
          //dispatch({ type: 'SET_NOTES', note })
          //Set_Input does nothing
          //dispatch({ type: 'SET_INPUT', note })
          //Reset does nothing
          //dispatch({ type: 'RESET_FORM', note })
          //ADD adds to the 2nd window
          //dispatch({ type: 'ADD_NOTE', note })
          //Do I need a DELETE_Note?
          //Do I need different const for set input?
          //Should I adjust subscription.js?
        }
      })
    return () => subscription.unsubscribe();
  }, [])

  useEffect(() => { 
    fetchNotes()
    const subscription = API.graphql({
      query: onUpdateNote
    })
      .subscribe({
        next: noteData => {
          const note = noteData.value.data.onUpdateNote
          if (CLIENT_ID === note.clientId) return
          //Reset does nothing on 2nd window
          //dispatch({ type: 'RESET_FORM', note })
          // Set_note removes entire list from both windows
          //dispatch({ type: 'SET_NOTES', note })
          //Set_Input does nothing
          //dispatch({ type: 'SET_INPUT', note })
          //ADD adds to the 2nd window
          //dispatch({ type: 'ADD_NOTE', note })
        }
      })
    return () => subscription.unsubscribe();
  }, []);

  const numberCompleted = async () => {
    try {
      const notesData = await API.graphql({
        query: listNotes
      });
      dispatch({ type: 'SET_NOTES', notes: [notesData.data.listNotes.items] });
    } catch (err) {
      console.log('error: ', err);
      dispatch({ type: 'ERROR' });
    }
  };

  //not working but keeping for reference
  // const countType = async(note) => {
  //   const countTypes = this.props.notes.filter(notes => listNotes.items === note);
  //   return listNotes.items.length;
  // }

  const listTotal = async (note) => {
    const index = state.notes.findIndex((n) => n.id === note.id);
    const notes = [...state.notes];
    notes[index].completed = !note.length.completed;
    dispatch({ type: "SET_NOTES", notes });
    try {
      await API.graphql({
        query: listTotal,
        variables: {
          input: { id: note.id, completed: notes[index] },
        },
      });
    } catch (err) {
      console.error(err);
    }
  };

  const styles = {
    container: { padding: 20 },
    input: { marginBottom: 10 },
    item: { textAlign: 'left' },
    p: { color: '#1890ff' }
  }

  function renderItem(item) {
    return (
      <List.Item style={styles.item}
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

      <Divider orientation="left" orientationMargin="0">
        Completed: {numberCompleted} vs. Total: {listTotal.length}
      </Divider>

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
