import React from 'react';
import 'antd/dist/antd.css';
import {
  Typography,
  Row,
  Col,
  message,
  Button,
  Input,
  Icon,
  Avatar,
  Progress,
  Tooltip,
  Tabs,
  Popover,
  Popconfirm,
  Select,
} from 'antd';
import { withNamespaces } from 'react-i18next';
import { withRouter } from 'react-router';
import { getTasksOfRoom, changeStatusOfMyTask } from '../../api/task';
import { SocketContext } from './../../context/SocketContext';
import { withUserContext } from './../../context/withUserContext';
import { config as configTask } from '../../config/task';
import { getUserAvatarUrl } from '../../helpers/common';
import ModalEditTask from './../task/ModalEditTask';
import moment from 'moment';
import ModalCreateTask from './../task/ModalCreateTask';
import { isAssignedToMe, isFinishTask } from './../../helpers/task';
import { doneTask, deleteTask, rejectTask } from './../../api/task';
import '../../scss/task.scss';

const { Text } = Typography;
const { TabPane } = Tabs;
const _ = require('lodash');

let editedTaskInfo = {};
let newTask = null;
let tabIndex = configTask.TYPE.MY_TASKS; //check tab task that user selected
const { Option } = Select;

class TasksOfRoom extends React.Component {
  static contextType = SocketContext;

  state = {
    tasksAssigned: [],
    myTasks: [],
    tasks: [],
    status: 0,
    percent: 0,
    keyVisibleStatus: '',
    stylePercent: 'none',
    keyVisible: '',
  };

  showCreateTaskModal = () => {
    newTask = null;
    this.setState({
      visibleCreateTask: true,
    });
  };

  hideCreateTaskModal = newTask => {
    if (newTask._id) {
      if (tabIndex == configTask.TYPE.MY_TASKS && isAssignedToMe(newTask, this.props.userContext.info._id)) {
        this.setState({
          myTasks: [newTask, ...this.state.myTasks],
          keyVisible: '',
        });
      } else {
        this.setState({
          tasksAssigned: [newTask, ...this.state.tasksAssigned],
          tasks: [newTask, ...this.state.tasks],
          keyVisible: '',
        });
      }
    }

    this.setState({
      visibleCreateTask: false,
    });
  };

  resetNewTask = () => {
    newTask = null;
  };

  formatDueTime(timeInput) {
    const { t } = this.props;
    const time = new Date(timeInput);

    return moment(time).format(t('format_time'));
  }

  getMyTasksOfRoom = roomId => {
    tabIndex = configTask.TYPE.MY_TASKS;

    getTasksOfRoom(roomId, configTask.TYPE.MY_TASKS).then(res => {
      this.setState({
        myTasks: res.data.results.tasks,
      });
    });
  };

  getTaskAssignedOfRoom = roomId => {
    tabIndex = configTask.TYPE.TASKS_ASSIGNED;

    getTasksOfRoom(roomId, configTask.TYPE.TASKS_ASSIGNED).then(res => {
      this.setState({
        tasksAssigned: res.data.results.tasks,
      });
    });
  };

  getAllTasksOfRoom = roomId => {
    tabIndex = configTask.TYPE.ALL;

    getTasksOfRoom(roomId).then(res => {
      this.setState({
        tasks: res.data.results.tasks,
      });
    });
  };

  componentDidMount() {
    const roomId = this.props.match.params.id;
    const { socket } = this.context;
    this.setState({ activeKey: '1' });

    this.getMyTasksOfRoom(roomId);
  }

  handleChangeTabs = key => {
    const roomId = this.props.match.params.id;
    this.setState({ activeKey: key });

    if (key == configTask.TYPE.MY_TASKS) {
      this.getMyTasksOfRoom(roomId);
    } else if (key == configTask.TYPE.TASKS_ASSIGNED) {
      this.getTaskAssignedOfRoom(roomId);
    } else {
      this.getAllTasksOfRoom(roomId);
    }
  };

  componentWillReceiveProps(nextProps) {
    const roomId = nextProps.match.params.id;

    if (this.props.match.params.id !== roomId) {
      if (tabIndex == configTask.TYPE.MY_TASKS) {
        this.getMyTasksOfRoom(roomId);
      } else if (tabIndex == configTask.TYPE.TASKS_ASSIGNED) {
        this.getTaskAssignedOfRoom(roomId);
      } else {
        this.getAllTasksOfRoom(roomId);
      }
    }
  }

  handleEditTask = e => {
    const taskId = e.target.closest('i').getAttribute('data-taskid');
    const { myTasks, tasks, tasksAssigned } = this.state;

    let editedTask;
    let assignees = [];
    let tasksTmp = [];
    if (tabIndex == configTask.TYPE.MY_TASKS) {
      tasksTmp = myTasks;
    } else if (tabIndex == configTask.TYPE.TASKS_ASSIGNED) {
      tasksTmp = tasksAssigned;
    } else {
      tasksTmp = tasks;
    }

    // Get edited task info
    tasksTmp.map(t => {
      if (t._id == taskId) {
        editedTask = t;
      }
    });

    // Get assigness in edited task
    editedTask.assignees.map(t => {
      assignees.push(t.user);
    });

    editedTaskInfo = {
      content: editedTask.content,
      start: editedTask.start,
      due: editedTask.due,
      assignees: assignees,
      id: taskId,
    };

    this.setState({
      visibleEditTask: true,
    });
  };

  handleHiddenEditTaskModal = () => {
    this.setState({
      visibleEditTask: false,
      keyVisible: '',
    });
  };

  updateDataWhenDeletingTask = taskId => {
    const { key: stateName, value: stateValue } = this.getStateFromTabIndex();
    let newState = {};

    newState[stateName] = _.filter(stateValue, function(task) {
      return task._id != taskId;
    });

    this.setState(newState);
  };

  updateDataWhenDoneTask = taskId => {
    const { key: stateName, value: stateValue } = this.getStateFromTabIndex();
    let newState = {};

    newState[stateName] = stateValue.map(task => {
      if (task._id == taskId) {
        let assignees = task.assignees;

        for (let i = 0; i < assignees.length; i++) {
          if (assignees[i].user == this.props.userContext.info._id) {
            assignees[i].percent = configTask.PERCENT.DONE;
            assignees[i].status = configTask.STATUS.DONE.VALUE;
            break;
          }
        }
      }

      return task;
    });

    this.setState(newState);
  };

  getStateFromTabIndex = () => {
    const { myTasks, tasksAssigned, tasks } = this.state;
    switch (tabIndex) {
      case configTask.TYPE.MY_TASKS:
        return {
          key: 'myTasks',
          value: myTasks,
        };
      case configTask.TYPE.TASKS_ASSIGNED:
        return {
          key: 'tasksAssigned',
          value: tasksAssigned,
        };
      default:
        return {
          key: 'tasks',
          value: tasks,
        };
    }
  };

  updateDataWhenRejectTask = taskId => {
    const { key: stateName, value: stateValue } = this.getStateFromTabIndex();

    let newState = {};
    newState[stateName] = stateValue.map(task => {
      if (task._id == taskId) {
        let assignees = task.assignees;

        for (let i = 0; i < assignees.length; i++) {
          if (assignees[i].user == this.props.userContext.info._id) {
            assignees[i].status = configTask.STATUS.REJECT.VALUE;
            break;
          }
        }
      }

      return task;
    });

    this.setState(newState);
  };

  handleDeleteTask = taskId => {
    const roomId = this.props.match.params.id;
    const { t } = this.props;

    deleteTask(roomId, taskId)
      .then(res => {
        message.success(t('messages.delete.success'));

        this.updateDataWhenDeletingTask(taskId);
      })
      .catch(error => {
        message.error(t('messages.delete.failed'));
      });
  };

  handleDoneTask = taskId => {
    const roomId = this.props.match.params.id;
    const { t } = this.props;

    doneTask(roomId, taskId)
      .then(res => {
        message.success(t('messages.done.success'));

        this.updateDataWhenDoneTask(taskId);
      })
      .catch(error => {
        message.error(t('messages.done.failed'));
      });
  };

  handleRejectTask = taskId => {
    const roomId = this.props.match.params.id;
    const { t } = this.props;

    rejectTask(roomId, taskId)
      .then(res => {
        message.success(t('messages.reject.success'));

        this.updateDataWhenRejectTask(taskId);
      })
      .catch(error => {
        message.error(t('messages.reject.failed'));
      });
  };

  updateEditedTaskIntoList = data => {
    let { myTasks, tasksAssigned, tasks } = this.state;

    if (data != undefined) {
      let indexOfEditedTask = -1;

      // Update tasks list when a task edited
      if (tabIndex == configTask.TYPE.MY_TASKS) {
        indexOfEditedTask = _.findIndex(myTasks, { _id: data._id });

        if (isAssignedToMe(data, this.props.userContext.info._id) && indexOfEditedTask != -1) {
          myTasks[indexOfEditedTask] = data;
        } else {
          myTasks.splice(indexOfEditedTask, 1);
        }

        this.setState({
          myTasks: myTasks,
        });
      } else if (tabIndex == configTask.TYPE.TASKS_ASSIGNED) {
        this.setState({
          tasksAssigned: tasksAssigned.map(task => {
            return task._id === data._id ? data : task;
          }),
        });
      } else {
        this.setState({
          tasks: tasks.map(task => {
            return task._id === data._id ? data : task;
          }),
        });
      }
    }
  };

  handleVisibleChangeStatus = (assignee = {}, keyTask = '', keyTab = '') => visible => {
    this.setState({
      keyTask: visible ? keyTask : '',
      keyTab: visible ? keyTab : '',
      keyVisible: visible ? assignee._id : '',
      percent: assignee.percent,
      status: assignee.status,
      stylePercent:
        assignee.status == configTask.STATUS.IN_PROGRESS.VALUE || assignee.status == configTask.STATUS.PENDING.VALUE
          ? 'block'
          : 'none',
    });
  };

  handleChangeStatus = (value = 0) => {
    this.setState({
      status: value,
      stylePercent:
        value == configTask.STATUS.IN_PROGRESS.VALUE || value == configTask.STATUS.PENDING.VALUE ? 'block' : 'none',
    });
  };

  handleChangePercent = (value = 0) => {
    this.setState({
      percent: value,
    });
  };

  updateDataWhenChangeStatusTask = (taskId, data) => {
    const { key: stateName, value: stateValue } = this.getStateFromTabIndex();
    let newState = {};

    newState[stateName] = stateValue.map(task => {
      if (task._id == taskId) {
        let assignees = task.assignees;

        for (let i = 0; i < assignees.length; i++) {
          if (assignees[i].user == data['userId']) {
            assignees[i].status = data['status'];
            assignees[i].percent = data['percent'];

            break;
          }
        }
      }
      
      return task;
    });

    this.setState(newState);
  };


  handleUpdateMyStatusTask = e => {
    e.preventDefault();
    const { roomId, t } = this.props;
    const taskId = e.target.value;
    const data = {};
    data['status'] = this.state.status;
    data['userId'] = e.target.getAttribute('data-userid');
    data['assigneeId'] = e.target.getAttribute('data-assigneeid');
    data['percent'] = this.state.percent;

    if (this.state.status == configTask.STATUS.NEW.VALUE) {
      data['percent'] = 0;
    } else if (this.state.status == configTask.STATUS.DONE.VALUE) {
      data['percent'] = configTask.PERCENT.DONE;
    } else if (
      this.state.status == configTask.STATUS.IN_PROGRESS.VALUE &&
      this.state.percent == configTask.PERCENT.DONE
    ) {
      data['percent'] = configTask.PERCENT.DONE;
      data['status'] = configTask.STATUS.DONE.VALUE;
    }

    changeStatusOfMyTask(roomId, taskId, data)
      .then(res => {
        message.success(t('messages.edit_status.success'));

        this.setState({
          percent: 0,
          status: 0,
        });
        this.updateDataWhenChangeStatusTask(taskId, data);
        this.handleVisibleChangeStatus()(true);
      })
      .catch(error => {
        message.error(t('messages.edit_status.failed'));
      });
  };

  renderContentChangeStatus = (assignee, taskId) => {
    const { t, form } = this.props;
    const statusHTML = [];
    const percentHTML = [];

    Object.values(configTask.STATUS).map((stt, key) => {
      statusHTML.push(
        <Option key={key} value={stt.VALUE}>
          {t(stt.TITLE)}
        </Option>
      );
    });

    for (let i = 0; i <= configTask.PERCENT.DONE; i += 10) {
      percentHTML.push(<Option key={i} value={i}>{i}</Option>);
    }

    return (
      <div className="change-status-box">
        <div>
          <Select defaultValue={t(assignee.statusTitle)} style={{ width: 160 }} onChange={this.handleChangeStatus}>
            {statusHTML}
          </Select>
        </div>
        <div style={{ display: this.state.stylePercent }}>
          <Select defaultValue={assignee.percent} style={{ width: 140 }} onChange={this.handleChangePercent}>
            {percentHTML}
          </Select>
          (%)
        </div>
        <div>
          <Button
            type="primary"
            htmlType="submit"
            value={taskId}
            data-userid={assignee.user}
            data-assigneeid={assignee._id}
            onClick={this.handleUpdateMyStatusTask}
          >
            {t('button.update')}
          </Button>
        </div>
      </div>
    );
  };

  render() {
    let members = [];
    let statusHTML = [];
    let condFilter = [];
    const myId = this.props.userContext.info._id;
    const roomId = this.props.match.params.id;
    const currentUserId = this.props.userContext.info._id;
    const { t, roomInfo } = this.props;
    const { myTasks, tasks, tasksAssigned } = this.state;
    const list_tasks = configTask.LIST_TASKS;

    if (roomInfo != undefined && typeof roomInfo != 'string') {
      members = this.props.members;
    }

    for (let index in list_tasks) {
      let list_task = [];

      if (list_tasks[index].KEY == configTask.TYPE.MY_TASKS) {
        list_task = [...myTasks];
      } else if (list_tasks[index].KEY == configTask.TYPE.TASKS_ASSIGNED) {
        list_task = [...tasksAssigned];
      } else {
        list_task = [...tasks];
      }

      condFilter.push(
        <TabPane tab={<Text strong>{t(`${list_tasks[index].TITLE}`)}</Text>} key={list_tasks[index].KEY}>
          <div className="content-desc-chat-room">
            <div>
              <Button type="flex" justify="start" className="box-add-task" onClick={this.showCreateTaskModal}>
                <Col span={18}>
                  <Icon type="check-square" /> {t('title.tasks.add_task')}
                </Col>
                <Col span={6}>
                  <Icon type="plus" />
                </Col>
              </Button>
            </div>
            {list_task
              ? list_task.map((task, key) => {
                  return (
                    <div className="content-task" key={key}>
                      <Row type="flex" justify="start" className="content-task-chat-room">
                        <Col span={24}>
                          <div>{task.content}</div>
                          <hr />
                        </Col>
                        <Col span={24}>
                          <div className="assignee-info">
                            {task.assignees.map((assignee, key) => {
                              const status = _.find(configTask.STATUS, { VALUE: assignee.status });
                              const color = status ? status.COLOR : '';
                              assignee.statusTitle = status ? t(status.TITLE) : '';

                              return (
                                <div key={key}>
                                  <Tooltip title={`${assignee.name}: ${assignee.percent}%`}>
                                    <Avatar src={getUserAvatarUrl(assignee.avatar)} />
                                    <Progress
                                      percent={assignee.percent}
                                      size="small"
                                      strokeColor={color}
                                      format={() => (status ? t(status.TITLE) : '')}
                                      status={status ? status.STATUS : ''}
                                    />
                                  </Tooltip>
                                  {assignee.user == myId ? (
                                    <React.Fragment>
                                      <Popover
                                        content={this.renderContentChangeStatus(
                                          assignee,
                                          task._id,
                                          list_tasks[index].KEY
                                        )}
                                        title={t('title.edit_status')}
                                        placement="topRight"
                                        trigger="click"
                                        visible={
                                          this.state.keyVisible === assignee._id &&
                                          this.state.keyTask == task._id &&
                                          this.state.keyTab == list_tasks[index].KEY
                                        }
                                        onVisibleChange={this.handleVisibleChangeStatus(
                                          assignee,
                                          task._id,
                                          list_tasks[index].KEY
                                        )}
                                      >
                                        <Tooltip title={t('title.edit_my_status')}>
                                          <Button className="btn-my-edit" value={assignee.user}>
                                            <Icon type="edit" />
                                          </Button>
                                        </Tooltip>
                                      </Popover>
                                    </React.Fragment>
                                  ) : (
                                    ''
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </Col>
                      </Row>
                      <hr />
                      <Row type="flex" justify="start" className="content-task-chat-room content-task-icon">
                        <Col span={18}>
                          <div className="task-assign">
                            <Avatar src={getUserAvatarUrl(task.assigner.avatar)} /> Start{' '}
                            <strong>{this.formatDueTime(task.start)}</strong> - Due{' '}
                            <strong>{this.formatDueTime(task.due)}</strong>
                          </div>
                        </Col>
                        <Col span={6}>
                          <div className="task-icon">
                            {this.props.userContext.info._id == task.assigner._id && (
                              <React.Fragment>
                                <a href="#">
                                  <Tooltip title={t('button.edit')}>
                                    <Icon type="edit" onClick={this.handleEditTask} data-taskid={task._id} />
                                  </Tooltip>
                                </a>
                                <Popconfirm
                                  title={t('messages.delete.confirm')}
                                  icon={<Icon type="question-circle-o" style={{ color: 'red' }} />}
                                  onConfirm={() => this.handleDeleteTask(task._id)}
                                  cancelText={t('button.cancel')}
                                >
                                  <a href="#">
                                    <Tooltip title={t('button.delete')}>
                                      <Icon type="delete" />
                                    </Tooltip>
                                  </a>
                                </Popconfirm>
                              </React.Fragment>
                            )}

                            {isAssignedToMe(task, currentUserId) && !isFinishTask(task, currentUserId) && (
                              <React.Fragment>
                                <a href="#" onClick={() => this.handleDoneTask(task._id)}>
                                  <Tooltip title={t('button.done')}>
                                    <Icon type="check-circle" theme="twoTone" twoToneColor="#1890ff" />
                                  </Tooltip>
                                </a>
                                <a href="#" onClick={() => this.handleRejectTask(task._id)}>
                                  <Tooltip title={t('button.reject')}>
                                    <Icon type="close-circle" theme="twoTone" twoToneColor="red" />
                                  </Tooltip>
                                </a>
                              </React.Fragment>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  );
                })
              : null}
          </div>
        </TabPane>
      );
    }

    return (
      <React.Fragment>
        <div className="chat-task">
          <Tabs onChange={this.handleChangeTabs} activeKey={this.state.activeKey}>
            {condFilter}
          </Tabs>
        </div>

        <ModalEditTask
          visibleModal={this.state.visibleEditTask}
          members={members}
          roomId={roomId}
          hiddenModal={this.handleHiddenEditTaskModal}
          task={editedTaskInfo}
          updateEditedTaskIntoList={this.updateEditedTaskIntoList}
        />
        <ModalCreateTask
          members={members}
          roomId={roomId}
          visibleCreateTask={this.state.visibleCreateTask}
          hideCreateTaskModal={this.hideCreateTaskModal}
          resetNewTask={this.resetNewTask}
        />
      </React.Fragment>
    );
  }
}

export default withRouter(withNamespaces(['task'])(withUserContext(TasksOfRoom)));
